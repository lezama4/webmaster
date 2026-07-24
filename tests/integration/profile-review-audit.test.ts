import { beforeEach, describe, expect, it } from "vitest";
import { createAccount } from "@domain/account/Account";
import {
  approveProfile,
  createProfile,
  deactivateProfile,
  rejectProfile,
  type Profile,
} from "@domain/profile/Profile";
import { PrismaAccountRepository } from "@infrastructure/persistence/prisma/AccountRepository";
import { PrismaProfileRepository } from "@infrastructure/persistence/prisma/ProfileRepository";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";

/**
 * ADR D25 (`auditable-profile-approval`, Phase 2.3) — proves the additive
 * `ProfileReview`/`ReviewDecision` migration against REAL Postgres, never
 * mocked: every profile that reached its current `active`/`rejected`/
 * `deactivated` status BEFORE this migration ran has ZERO `ProfileReview`
 * rows afterward, and every pre-existing field on those rows is untouched.
 * Legacy rows are NEVER back-filled with an invented basis (D25) — the
 * absence of rows IS the correct, honest representation.
 *
 * This file is EXTENDED further in Phase 3 (task 3.10) with the cycle-proof
 * and atomicity cases once `saveReview`/`validateProfile`/`deactivateProfile`
 * wiring lands (PR2) — this task adds ONLY the migration-survival cases.
 */
const dbAvailable = await isDatabaseAvailable();

// PR2 wiring handoff (auditable-profile-approval, PR1/domain-only batch):
// approveProfile/rejectProfile/deactivateProfile now require an attributed
// ReviewInput and a Clock (ADR D21-D24). This suite proves MIGRATION
// survival — that profiles which reached their status BEFORE this change
// have zero ProfileReview rows — not the review-persistence wiring itself
// (PR2's `saveReview` is what will actually write review rows through the
// application layer). A fixed placeholder satisfies the domain's required
// shape without asserting anything about the review it produces (this
// batch never calls `ctx.saveReview`, so no ProfileReview row is written
// by these domain calls at all — exactly what proves the migration-era
// absence).
const PLACEHOLDER_REVIEW = {
  adminAccountId: "fixture-admin",
  basis: "Fixture-only placeholder basis (PR2 wires the real actor/basis).",
  reviewId: "fixture-review",
};
const PLACEHOLDER_CLOCK = { now: () => new Date() };

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

describe.skipIf(!dbAvailable)(
  "ProfileReview migration survival (ADR D25, Phase 2.3)",
  () => {
    const client = getTestPrismaClient();
    const accounts = new PrismaAccountRepository(client);
    const profiles = new PrismaProfileRepository(client);

    beforeEach(async () => {
      await resetDatabase(client);
    });

    async function seedAccountAndPendingProfile(role: "centre" | "artist") {
      const accountId = nextId("account");
      const account = createAccount({
        id: accountId,
        email: `${nextId("legacy")}@vtt.test`,
        role,
      });
      await accounts.save({ account, passwordHash: "unused-in-integration-test" });

      const pending = createProfile({
        id: nextId("profile"),
        accountId,
        type: role === "centre" ? "centre" : "artist",
        ...(role === "centre" ? { centreType: "hospital" as const } : {}),
        name: role === "centre" ? "Legacy Hospital San Marcos" : "Legacy Artist Iker",
        ...(role === "centre"
          ? {
              city: "Bilbao",
              postalCode: "48001",
              addressLine: "Calle Legacy, 1",
              latitude: 43.26,
              longitude: -2.93,
            }
          : {}),
      });
      return { account, pending };
    }

    it("a pre-existing ACTIVE profile has zero ProfileReview rows, and every other field is byte-identical after the migration", async () => {
      const { pending } = await seedAccountAndPendingProfile("centre");
      const { profile: active } = approveProfile(
        pending,
        PLACEHOLDER_REVIEW,
        PLACEHOLDER_CLOCK,
      );
      await profiles.save(active);

      const reviewRows = await client.profileReview.findMany({
        where: { profileId: active.id },
      });
      expect(reviewRows).toHaveLength(0);

      const rehydrated = await profiles.findById(active.id);
      expect(rehydrated).toEqual<Profile>(active);
    });

    it("a pre-existing REJECTED profile has zero ProfileReview rows, and every other field is byte-identical after the migration", async () => {
      const { pending } = await seedAccountAndPendingProfile("centre");
      const { profile: rejected } = rejectProfile(
        pending,
        PLACEHOLDER_REVIEW,
        PLACEHOLDER_CLOCK,
      );
      await profiles.save(rejected);

      const reviewRows = await client.profileReview.findMany({
        where: { profileId: rejected.id },
      });
      expect(reviewRows).toHaveLength(0);

      const rehydrated = await profiles.findById(rejected.id);
      expect(rehydrated).toEqual<Profile>(rejected);
    });

    it("a pre-existing DEACTIVATED profile has zero ProfileReview rows, and every other field is byte-identical after the migration", async () => {
      const { pending } = await seedAccountAndPendingProfile("artist");
      const { profile: active } = approveProfile(
        pending,
        PLACEHOLDER_REVIEW,
        PLACEHOLDER_CLOCK,
      );
      const { profile: deactivated } = deactivateProfile(
        active,
        PLACEHOLDER_REVIEW,
        PLACEHOLDER_CLOCK,
      );
      await profiles.save(deactivated);

      const reviewRows = await client.profileReview.findMany({
        where: { profileId: deactivated.id },
      });
      expect(reviewRows).toHaveLength(0);

      const rehydrated = await profiles.findById(deactivated.id);
      expect(rehydrated).toEqual<Profile>(deactivated);
    });

    it("the migration inserts NO ProfileReview rows for any pre-existing profile (table-wide, not just per-row)", async () => {
      const { pending: pendingCentre } = await seedAccountAndPendingProfile("centre");
      const { profile: active } = approveProfile(
        pendingCentre,
        PLACEHOLDER_REVIEW,
        PLACEHOLDER_CLOCK,
      );
      await profiles.save(active);

      const { pending: pendingArtist } = await seedAccountAndPendingProfile("artist");
      const { profile: rejected } = rejectProfile(
        pendingArtist,
        PLACEHOLDER_REVIEW,
        PLACEHOLDER_CLOCK,
      );
      await profiles.save(rejected);

      expect(await client.profileReview.count()).toBe(0);
    });

    it("the new ProfileReview table/enum accept a row for an existing profile (schema round-trip proof)", async () => {
      const { pending } = await seedAccountAndPendingProfile("centre");
      const { profile: active } = approveProfile(
        pending,
        PLACEHOLDER_REVIEW,
        PLACEHOLDER_CLOCK,
      );
      await profiles.save(active);

      // Direct schema-level proof that the migration's CREATE TABLE/CREATE
      // TYPE actually work end-to-end — NOT the application-layer
      // `saveReview` wiring (PR2's job, task 3.10 extends this file with
      // that atomicity/cycle proof).
      const created = await client.profileReview.create({
        data: {
          profileId: active.id,
          adminAccountId: "admin-schema-check",
          decision: "APPROVE",
          basis: "Schema round-trip check.",
        },
      });

      expect(created.decision).toBe("APPROVE");
      expect(await client.profileReview.count({ where: { profileId: active.id } })).toBe(
        1,
      );

      // The Profile row itself is completely unaffected by this insert.
      const rehydrated = await profiles.findById(active.id);
      expect(rehydrated).toEqual<Profile>(active);
    });
  },
);
