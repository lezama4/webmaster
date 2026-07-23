import { beforeEach, describe, expect, it } from "vitest";
import type { CentreType } from "@domain/profile/Profile";
import { registerProfile } from "@application/use-cases/registerProfile";
import { validateProfile } from "@application/use-cases/validateProfile";
import { publishSlot } from "@application/use-cases/publishSlot";
import { closeSlot } from "@application/use-cases/closeSlot";
import type { Actor } from "@application/Actor";
import { PrismaRegistrationUnitOfWork } from "@infrastructure/persistence/prisma/RegistrationUnitOfWork";
import { PrismaProfileUnitOfWork } from "@infrastructure/persistence/prisma/ProfileUnitOfWork";
import { PrismaProfileRepository } from "@infrastructure/persistence/prisma/ProfileRepository";
import { PrismaMatchingUnitOfWork } from "@infrastructure/persistence/prisma/MatchingUnitOfWork";
import { Argon2PasswordHasher } from "@infrastructure/auth/passwordHasher";
import { CryptoIdGenerator } from "@infrastructure/shared/idGenerator";
import { SystemClock } from "@infrastructure/shared/clock";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import { createHospitalProfile } from "./support/fixtures";

/**
 * Phase 2.9/2.10 (ADR D18, `widen-beyond-hospitals`) — proves, against REAL
 * Postgres, D16's gradable claim at runtime: all six `centreType` values
 * register -> get admin-validated -> publish a Slot through the IDENTICAL
 * guard path (`assertRole`/`assertActiveProfile` checking `role`/`type`
 * only, never `centreType`). No guard branches on `centreType` — the
 * registration/validation/publication code path is byte-identical across
 * all six kinds; only the persisted `centreType` value differs.
 *
 * Also covers the "pre-migration hospital account is unaffected" scenario
 * (centre-registration spec): a hospital-shaped profile — exactly the shape
 * `centre-migration.test.ts` (Phase 1.9) proves the migration produces —
 * performs the SAME centre-only actions (publish, close) with zero
 * behavioural change.
 */
const dbAvailable = await isDatabaseAvailable();

const ALL_CENTRE_TYPES: readonly CentreType[] = [
  "hospital",
  "nursing_home",
  "day_centre",
  "day_hospital",
  "occupational_centre",
  "palliative_unit",
];

describe.skipIf(!dbAvailable)(
  "centre lifecycle: register -> admin validates -> publish a Slot (D16/D18, Phase 2.9/2.10)",
  () => {
    const client = getTestPrismaClient();
    const admin: Actor = { accountId: "centre-lifecycle-admin", role: "admin" };

    beforeEach(async () => {
      await resetDatabase(client);
    });

    function registrationDeps() {
      return {
        registrationUnitOfWork: new PrismaRegistrationUnitOfWork(client),
        passwordHasher: new Argon2PasswordHasher(),
        idGenerator: new CryptoIdGenerator(),
        clock: new SystemClock(),
      };
    }

    function adminDeps() {
      return {
        profiles: new PrismaProfileRepository(client),
        profileUnitOfWork: new PrismaProfileUnitOfWork(client),
      };
    }

    function publishSlotDeps() {
      return {
        profileUnitOfWork: new PrismaProfileUnitOfWork(client),
        idGenerator: new CryptoIdGenerator(),
        clock: new SystemClock(),
      };
    }

    it.each(ALL_CENTRE_TYPES)(
      "registers, gets admin-validated, and publishes a Slot through the identical guard path: %s",
      async (centreType) => {
        const email = `centre-lifecycle.${centreType}@vtt.test`;

        const pending = await registerProfile(
          {
            email,
            password: "S3cure!pass",
            role: "centre",
            centreType,
            name: `Some ${centreType} centre`,
          },
          registrationDeps(),
        );
        expect(pending.status).toBe("pending");
        expect(pending.centreType).toBe(centreType);

        const activated = await validateProfile(
          admin,
          { profileId: pending.id, decision: "approve" },
          adminDeps(),
        );
        expect(activated.status).toBe("active");
        expect(activated.centreType).toBe(centreType); // unchanged by validation

        const centreActor: Actor = { accountId: pending.accountId, role: "centre" };
        const slot = await publishSlot(
          centreActor,
          {
            title: `Afternoon session (${centreType})`,
            description: "A calm, welcoming moment for the people there.",
            scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            durationMinutes: 45,
            location: "Main hall",
            audience: "all_ages",
          },
          publishSlotDeps(),
        );
        expect(slot.hospitalProfileId).toBe(pending.id);

        // The persisted centreType is exactly what was submitted — untouched
        // by registration, validation, or slot publication.
        const persisted = await client.profile.findUniqueOrThrow({
          where: { id: pending.id },
        });
        expect(persisted.centreType).toBe(centreType.toUpperCase());
      },
    );

    it("pre-migration hospital account is unaffected: publishes and closes a Slot exactly like any other centre", async () => {
      const { account, profile } = await createHospitalProfile(client, {
        name: "Pre-Migration Hospital",
      });
      expect(profile.centreType).toBe("hospital");
      const centreActor: Actor = { accountId: account.id, role: "centre" };

      const slot = await publishSlot(
        centreActor,
        {
          title: "Story time",
          description: "A quiet reading corner.",
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          durationMinutes: 30,
          location: "Ward 3",
          audience: "all_ages",
        },
        publishSlotDeps(),
      );
      expect(slot.hospitalProfileId).toBe(profile.id);

      const closeResult = await closeSlot(
        centreActor,
        { slotId: slot.id },
        {
          matchingUnitOfWork: new PrismaMatchingUnitOfWork(client),
          clock: new SystemClock(),
        },
      );
      expect(closeResult.slot.status).toBe("closed");
    });
  },
);
