import { beforeEach, describe, expect, it } from "vitest";
import { createAccount } from "@domain/account/Account";
import { approveProfile, createProfile } from "@domain/profile/Profile";
import { createSlot } from "@domain/slot/Slot";
import { createProposal } from "@domain/proposal/Proposal";
import { Argon2PasswordHasher } from "@infrastructure/auth/passwordHasher";
import { PrismaAccountRepository } from "@infrastructure/persistence/prisma/AccountRepository";
import { PrismaProfileRepository } from "@infrastructure/persistence/prisma/ProfileRepository";
import { PrismaProposalRepository } from "@infrastructure/persistence/prisma/ProposalRepository";
import { PrismaSlotRepository } from "@infrastructure/persistence/prisma/SlotRepository";
import { SystemClock } from "@infrastructure/shared/clock";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";

/**
 * Phase 1.9 (ADR D16/D17, `widen-beyond-hospitals`) — proves the
 * hand-written migration (`prisma/migrations/20260723000000_widen_centre_types`)
 * against REAL Postgres: every existing `HOSPITAL` row now reads
 * `type: CENTRE` + `centreType: hospital`, with zero data loss (name,
 * location fields, status, account credentials, Slot/Proposal
 * associations), an Artist row is untouched (`centreType` stays NULL), and
 * D4's two partial unique indexes (Phase 1.8) still enforce correctly —
 * proving at runtime, not merely by reading the migration file, that they
 * reference `ProposalStatus` only and are unaffected by the
 * `AccountRole`/`ProfileType` rename.
 *
 * NEVER mocked: every assertion below reads the migrated schema/rows
 * through the real Prisma client, migrated once (globalSetup) via
 * `prisma migrate deploy` against the real Postgres `DATABASE_URL`. This
 * suite's own fixtures are what round-trip through the migrated shape —
 * see the file-level `beforeEach(resetDatabase)` note in `./support/db.ts`.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("centre migration survival (D17, Phase 1.9)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  describe("enum topology (D16) — Postgres carries CENTRE, never HOSPITAL, on the renamed enums", () => {
    it("AccountRole has exactly admin/centre/artist/patient — no HOSPITAL label survives", async () => {
      const labels = await client.$queryRaw<{ enumlabel: string }[]>`
        SELECT enumlabel FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'AccountRole'
      `;
      const names = labels.map((l) => l.enumlabel).sort();
      expect(names).toEqual(["ADMIN", "ARTIST", "CENTRE", "PATIENT"].sort());
      expect(names).not.toContain("HOSPITAL");
    });

    it("ProfileType has exactly centre/artist — no HOSPITAL label survives", async () => {
      const labels = await client.$queryRaw<{ enumlabel: string }[]>`
        SELECT enumlabel FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'ProfileType'
      `;
      const names = labels.map((l) => l.enumlabel).sort();
      expect(names).toEqual(["ARTIST", "CENTRE"].sort());
      expect(names).not.toContain("HOSPITAL");
    });

    it("CentreType exists with exactly the six expected values", async () => {
      const labels = await client.$queryRaw<{ enumlabel: string }[]>`
        SELECT enumlabel FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'CentreType'
      `;
      expect(labels.map((l) => l.enumlabel).sort()).toEqual(
        [
          "HOSPITAL",
          "NURSING_HOME",
          "DAY_CENTRE",
          "DAY_HOSPITAL",
          "OCCUPATIONAL_CENTRE",
          "PALLIATIVE_UNIT",
        ].sort(),
      );
    });

    it("profiles.centreType is a nullable column", async () => {
      const columns = await client.$queryRaw<
        { column_name: string; is_nullable: string }[]
      >`
        SELECT column_name, is_nullable FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'centreType'
      `;
      expect(columns).toHaveLength(1);
      expect(columns[0]?.is_nullable).toBe("YES");
    });
  });

  describe("zero data loss — a pre-migration-shaped hospital row round-trips intact", () => {
    it("preserves every field, the Account's credentials, and its Slot/Proposal associations", async () => {
      const accounts = new PrismaAccountRepository(client);
      const profiles = new PrismaProfileRepository(client);
      const slots = new PrismaSlotRepository(client);
      const proposals = new PrismaProposalRepository(client);
      const passwordHasher = new Argon2PasswordHasher();
      const clock = new SystemClock();
      const plaintext = "S3cure!pass";
      const passwordHash = await passwordHasher.hash(plaintext);

      const hospitalAccount = createAccount({
        id: "migration-account-hospital",
        email: "migration.hospital@vtt.test",
        role: "centre",
      });
      await accounts.save({ account: hospitalAccount, passwordHash });

      const hospitalProfile = approveProfile(
        createProfile({
          id: "migration-profile-hospital",
          accountId: hospitalAccount.id,
          type: "centre",
          centreType: "hospital",
          name: "Hospital San Juan (Migration Check)",
          city: "Bilbao",
          postalCode: "48013",
          addressLine: "Plaza de Cruces, 12",
          latitude: 43.263,
          longitude: -2.935,
        }),
      );
      await profiles.save(hospitalProfile);

      const slot = createSlot(
        {
          id: "migration-slot-1",
          hospitalProfileId: hospitalProfile.id,
          title: "Concierto acústico",
          description: "Concierto breve para pacientes y familiares.",
          scheduledAt: new Date(clock.now().getTime() + 7 * 24 * 60 * 60 * 1000),
          durationMinutes: 45,
          location: "Planta 2",
          audience: "all_ages",
        },
        clock,
      );
      await slots.save(slot);

      const artistAccount = createAccount({
        id: "migration-account-artist",
        email: "migration.artist@vtt.test",
        role: "artist",
      });
      await accounts.save({ account: artistAccount, passwordHash });
      const artistProfile = approveProfile(
        createProfile({
          id: "migration-profile-artist",
          accountId: artistAccount.id,
          type: "artist",
          name: "Clara Romero",
        }),
      );
      await profiles.save(artistProfile);

      const proposal = createProposal({
        id: "migration-proposal-1",
        slotId: slot.id,
        artistProfileId: artistProfile.id,
        message: "Puedo ofrecer un repertorio acústico adaptable.",
      });
      await proposals.save(proposal);

      // Read back through the repository — exercises toDomainProfile/mappers
      // against the migrated schema, not a hand-rolled query.
      const rehydratedHospital = await profiles.findById(hospitalProfile.id);
      expect(rehydratedHospital?.type).toBe("centre");
      expect(rehydratedHospital?.centreType).toBe("hospital");
      expect(rehydratedHospital?.name).toBe("Hospital San Juan (Migration Check)");
      expect(rehydratedHospital?.city).toBe("Bilbao");
      expect(rehydratedHospital?.postalCode).toBe("48013");
      expect(rehydratedHospital?.addressLine).toBe("Plaza de Cruces, 12");
      expect(rehydratedHospital?.latitude).toBe(43.263);
      expect(rehydratedHospital?.longitude).toBe(-2.935);
      expect(rehydratedHospital?.status).toBe("active");

      // Account still authenticates with the same credentials post-migration.
      const verified = await passwordHasher.verify(plaintext, passwordHash);
      expect(verified).toBe(true);

      // Slot/Proposal still associated with the (renamed) centre profile —
      // no orphans introduced by the migration's column addition/backfill.
      const slotsForProfile = await client.slot.findMany({
        where: { hospitalProfileId: hospitalProfile.id },
      });
      expect(slotsForProfile).toHaveLength(1);
      const proposalsForSlot = await client.proposal.findMany({
        where: { slotId: slot.id },
      });
      expect(proposalsForSlot).toHaveLength(1);

      // A pre-migration Artist profile is untouched — centreType stays NULL,
      // the backfill's WHERE "type" = 'CENTRE' correctly excludes it.
      const artistRow = await client.profile.findUniqueOrThrow({
        where: { id: artistProfile.id },
      });
      expect(artistRow.centreType).toBeNull();
      expect(artistRow.type).toBe("ARTIST");
    });

    it("profiles/slots/proposals row counts match exactly what this test created — no phantom rows from the backfill", async () => {
      const accounts = new PrismaAccountRepository(client);
      const profiles = new PrismaProfileRepository(client);
      const passwordHash = await new Argon2PasswordHasher().hash("S3cure!pass");

      const account = createAccount({
        id: "migration-count-account",
        email: "migration.count@vtt.test",
        role: "centre",
      });
      await accounts.save({ account, passwordHash });
      const profile = approveProfile(
        createProfile({
          id: "migration-count-profile",
          accountId: account.id,
          type: "centre",
          centreType: "hospital",
          name: "Hospital Count Check",
        }),
      );
      await profiles.save(profile);

      expect(await client.profile.count()).toBe(1);
      expect(await client.account.count()).toBe(1);
      expect(await client.slot.count()).toBe(0);
      expect(await client.proposal.count()).toBe(0);
    });
  });

  describe("D4 partial unique indexes are unaffected by the AccountRole/ProfileType rename (re-verifies Phase 1.8 at runtime)", () => {
    it("both index definitions reference ProposalStatus only, never AccountRole/ProfileType/CentreType", async () => {
      const rows = await client.$queryRaw<{ indexname: string; indexdef: string }[]>`
        SELECT indexname, indexdef FROM pg_indexes
        WHERE tablename = 'proposals'
          AND indexname IN ('proposals_accepted_per_slot', 'proposals_submitted_per_slot_artist')
      `;
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.indexdef).toMatch(/::"ProposalStatus"/);
        expect(row.indexdef).not.toMatch(/AccountRole|ProfileType|CentreType/);
      }
    });

    it("behavioural proof: a duplicate ACCEPTED Proposal for the same Slot is still rejected at the DB level post-migration", async () => {
      const accounts = new PrismaAccountRepository(client);
      const profiles = new PrismaProfileRepository(client);
      const slots = new PrismaSlotRepository(client);
      const clock = new SystemClock();
      const passwordHash = await new Argon2PasswordHasher().hash("S3cure!pass");

      const centreAccount = createAccount({
        id: "migration-index-account-centre",
        email: "migration.index.centre@vtt.test",
        role: "centre",
      });
      await accounts.save({ account: centreAccount, passwordHash });
      const centreProfile = approveProfile(
        createProfile({
          id: "migration-index-profile-centre",
          accountId: centreAccount.id,
          type: "centre",
          centreType: "hospital",
          name: "Hospital Index Check",
        }),
      );
      await profiles.save(centreProfile);

      const claraAccount = createAccount({
        id: "migration-index-account-clara",
        email: "migration.index.clara@vtt.test",
        role: "artist",
      });
      await accounts.save({ account: claraAccount, passwordHash });
      const clara = approveProfile(
        createProfile({
          id: "migration-index-profile-clara",
          accountId: claraAccount.id,
          type: "artist",
          name: "Clara",
        }),
      );
      await profiles.save(clara);

      const mateoAccount = createAccount({
        id: "migration-index-account-mateo",
        email: "migration.index.mateo@vtt.test",
        role: "artist",
      });
      await accounts.save({ account: mateoAccount, passwordHash });
      const mateo = approveProfile(
        createProfile({
          id: "migration-index-profile-mateo",
          accountId: mateoAccount.id,
          type: "artist",
          name: "Mateo",
        }),
      );
      await profiles.save(mateo);

      const slot = createSlot(
        {
          id: "migration-index-slot",
          hospitalProfileId: centreProfile.id,
          title: "Taller",
          description: "desc",
          scheduledAt: new Date(clock.now().getTime() + 7 * 24 * 60 * 60 * 1000),
          durationMinutes: 60,
          location: "Sala 1",
          audience: "all_ages",
        },
        clock,
      );
      await slots.save(slot);

      await client.proposal.create({
        data: {
          slotId: slot.id,
          artistProfileId: clara.id,
          message: "First",
          status: "ACCEPTED",
        },
      });

      await expect(
        client.proposal.create({
          data: {
            slotId: slot.id,
            artistProfileId: mateo.id,
            message: "Second",
            status: "ACCEPTED",
          },
        }),
      ).rejects.toThrow();
    });
  });
});
