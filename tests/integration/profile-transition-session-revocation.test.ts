import { beforeEach, describe, expect, it } from "vitest";
import { deactivateProfile } from "@application/use-cases/deactivateProfile";
import { validateProfile } from "@application/use-cases/validateProfile";
import type { Actor } from "@application/Actor";
import { createProfile } from "@domain/profile/Profile";
import { PrismaProfileRepository } from "@infrastructure/persistence/prisma/ProfileRepository";
import { PrismaProfileUnitOfWork } from "@infrastructure/persistence/prisma/ProfileUnitOfWork";
import { createPrismaSessionPort } from "@infrastructure/auth/session";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import { createHospitalProfile } from "./support/fixtures";

/**
 * Task 4.21 (M3): Admin deactivation and Admin rejection each atomically
 * revoke every live session for the Profile's Account, via
 * `ProfileUnitOfWork.withLockedProfile` — the SAME transaction as the
 * status transition (D7).
 */
const dbAvailable = await isDatabaseAvailable();

const adminActor: Actor = { accountId: "admin-account", role: "admin" };

describe.skipIf(!dbAvailable)(
  "Profile transition -> session revocation (4.21, M3)",
  () => {
    const client = getTestPrismaClient();

    beforeEach(async () => {
      await resetDatabase(client);
    });

    it("deactivation revokes every live session for the Account", async () => {
      const { account, profile } = await createHospitalProfile(client);
      const sessions = createPrismaSessionPort(client);
      const session = await sessions.create(account.id);

      const deps = {
        profiles: new PrismaProfileRepository(client),
        profileUnitOfWork: new PrismaProfileUnitOfWork(client),
      };
      const updated = await deactivateProfile(adminActor, { profileId: profile.id }, deps);

      expect(updated.status).toBe("deactivated");
      expect(await sessions.resolveValid(session.id)).toBeNull();
    });

    it("rejecting a pending Profile revokes every live session for the Account", async () => {
      const profiles = new PrismaProfileRepository(client);
      const { account } = await createHospitalProfile(client, { name: "unused" });
      // Overwrite to a fresh PENDING Profile for the rejection path.
      const pendingProfile = createProfile({
        id: `${account.id}-pending`,
        accountId: account.id,
        type: "hospital",
        name: "Pending Hospital",
      });
      await client.profile.deleteMany({ where: { accountId: account.id } });
      await profiles.save(pendingProfile);

      const sessions = createPrismaSessionPort(client);
      const session = await sessions.create(account.id);

      const deps = {
        profiles,
        profileUnitOfWork: new PrismaProfileUnitOfWork(client),
      };
      const updated = await validateProfile(
        adminActor,
        { profileId: pendingProfile.id, decision: "reject" },
        deps,
      );

      expect(updated.status).toBe("rejected");
      expect(await sessions.resolveValid(session.id)).toBeNull();
    });

    it("approving a pending Profile does NOT revoke live sessions", async () => {
      const profiles = new PrismaProfileRepository(client);
      const { account } = await createHospitalProfile(client);
      const pendingProfile = createProfile({
        id: `${account.id}-pending`,
        accountId: account.id,
        type: "hospital",
        name: "Pending Hospital",
      });
      await client.profile.deleteMany({ where: { accountId: account.id } });
      await profiles.save(pendingProfile);

      const sessions = createPrismaSessionPort(client);
      const session = await sessions.create(account.id);

      const deps = {
        profiles,
        profileUnitOfWork: new PrismaProfileUnitOfWork(client),
      };
      await validateProfile(
        adminActor,
        { profileId: pendingProfile.id, decision: "approve" },
        deps,
      );

      expect(await sessions.resolveValid(session.id)).not.toBeNull();
    });
  },
);
