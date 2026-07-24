import { beforeEach, describe, expect, it } from "vitest";
import { approveProposal } from "@application/use-cases/approveProposal";
import { deactivateProfile } from "@application/use-cases/deactivateProfile";
import type { Actor } from "@application/Actor";
import { ForbiddenError } from "@application/errors";
import { PrismaMatchingUnitOfWork } from "@infrastructure/persistence/prisma/MatchingUnitOfWork";
import { PrismaProfileRepository } from "@infrastructure/persistence/prisma/ProfileRepository";
import { PrismaProfileUnitOfWork } from "@infrastructure/persistence/prisma/ProfileUnitOfWork";
import { CryptoIdGenerator } from "@infrastructure/shared/idGenerator";
import { SystemClock } from "@infrastructure/shared/clock";
import { createDeferred, waitForPostgresLockWait } from "./support/barrier";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import {
  createArtistProfile,
  createHospitalProfile,
  createOpenSlot,
  createSubmittedProposal,
} from "./support/fixtures";
import { actorFor, slotDeps } from "./support/wiring";

// PR2 (auditable-profile-approval): deactivateProfile now requires a real
// basis (ADR D21-D24) — this suite is about lock ordering, not the review
// audit trail itself, so a fixed valid basis is enough.
const DEACTIVATE_BASIS = "Lock-order race test — unrelated to the review audit trail itself.";

/**
 * recheck-pr2a-verify-M2: barrier-based interleave of a Slot-mutating use
 * case (`approveProposal`) and an Admin `deactivateProfile` targeting the
 * SAME actor's Account. This proves `MatchingUnitOfWork.withLockedSlot` now
 * locks the Slot AND the actor's Account, and reads the actor's Profile,
 * inside ONE transaction that also persists the Slot mutation — closing the
 * window where a separate `ProfileUnitOfWork` transaction could authorize
 * the actor, commit, and release the Account lock BEFORE the Slot mutation
 * was persisted.
 *
 * Global lock order under test: Slot FIRST, then Account (documented on
 * `MatchingUnitOfWork`). Both linearizations are forced against REAL
 * Postgres locking, not merely a JS-level Promise race.
 */
const dbAvailable = await isDatabaseAvailable();

const adminActor: Actor = { accountId: "admin-account-slot-auth", role: "admin" };

describe.skipIf(!dbAvailable)("race: Slot authorization vs. Admin deactivation (recheck-pr2a-verify-M2)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("Order 1: the Slot mutation authorizes and holds the Account lock FIRST — a concurrent deactivation of the SAME actor blocks, then commits AFTER the mutation, ending the profile 'deactivated'", async () => {
    const { account: hospitalAccount, profile: hospital } = await createHospitalProfile(client);
    const { profile: artist } = await createArtistProfile(client);
    const slot = await createOpenSlot(client, hospital.id);
    const proposal = await createSubmittedProposal(client, slot.id, artist.id);

    const approveHoldsLock = createDeferred<void>();
    const approveLockAcquired = createDeferred<void>();
    const approveUoW = new PrismaMatchingUnitOfWork(client, {
      afterLock: async () => {
        approveLockAcquired.resolve();
        await approveHoldsLock.promise;
      },
    });

    const hospitalActor = actorFor(hospital, hospitalAccount.id, "centre");

    const approvePromise = approveProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: proposal.id },
      { ...slotDeps(client), matchingUnitOfWork: approveUoW },
    );

    // By the time `afterLock` fires, the approve transaction has ALREADY
    // locked the Slot row AND the hospital's Account row, and read its
    // live Profile — the atomic unit under test.
    await approveLockAcquired.promise;

    const deactivatePromise = deactivateProfile(
      adminActor,
      { profileId: hospital.id, basis: DEACTIVATE_BASIS },
      {
        profiles: new PrismaProfileRepository(client),
        profileUnitOfWork: new PrismaProfileUnitOfWork(client),
        idGenerator: new CryptoIdGenerator(),
        clock: new SystemClock(),
      },
    );

    await waitForPostgresLockWait(client, "accounts");
    approveHoldsLock.resolve(); // release approve — it commits with the still-active Profile.

    const [approveResult, deactivateResult] = await Promise.allSettled([
      approvePromise,
      deactivatePromise,
    ]);

    expect(approveResult.status).toBe("fulfilled");
    expect(deactivateResult.status).toBe("fulfilled");

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("FILLED");
    const finalProposal = await client.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(finalProposal.status).toBe("ACCEPTED");

    const finalProfile = await client.profile.findUniqueOrThrow({ where: { id: hospital.id } });
    expect(finalProfile.status).toBe("DEACTIVATED");
  });

  it("Order 2: deactivation locks the Account and commits FIRST — the Slot mutation then reads the deactivated Profile inside its own transaction and is denied, with NOTHING persisted", async () => {
    const { account: hospitalAccount, profile: hospital } = await createHospitalProfile(client);
    const { profile: artist } = await createArtistProfile(client);
    const slot = await createOpenSlot(client, hospital.id);
    const proposal = await createSubmittedProposal(client, slot.id, artist.id);

    await deactivateProfile(
      adminActor,
      { profileId: hospital.id, basis: DEACTIVATE_BASIS },
      {
        profiles: new PrismaProfileRepository(client),
        profileUnitOfWork: new PrismaProfileUnitOfWork(client),
        idGenerator: new CryptoIdGenerator(),
        clock: new SystemClock(),
      },
    );

    const finalProfileAfterDeactivation = await client.profile.findUniqueOrThrow({
      where: { id: hospital.id },
    });
    expect(finalProfileAfterDeactivation.status).toBe("DEACTIVATED");

    const hospitalActor = actorFor(hospital, hospitalAccount.id, "centre");

    await expect(
      approveProposal(
        hospitalActor,
        { slotId: slot.id, proposalId: proposal.id },
        slotDeps(client),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("OPEN");
    const finalProposal = await client.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(finalProposal.status).toBe("SUBMITTED");
    const events = await client.event.findMany({ where: { slotId: slot.id } });
    expect(events).toHaveLength(0);
  });
});
