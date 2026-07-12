import { beforeEach, describe, expect, it } from "vitest";
import { approveProposal } from "@application/use-cases/approveProposal";
import { closeSlot } from "@application/use-cases/closeSlot";
import { ConflictError } from "@application/errors";
import { PrismaMatchingUnitOfWork } from "@infrastructure/persistence/prisma/MatchingUnitOfWork";
import { createDeferred, waitForPostgresLockWait } from "./support/barrier";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import {
  createArtistProfile,
  createHospitalProfile,
  createOpenSlot,
  createSubmittedProposal,
} from "./support/fixtures";
import { actorFor, slotDeps } from "./support/wiring";

/**
 * Task 4.13 (M2 pr2-review). pr2b-M5 strengthening: `approveProposal` and
 * `closeSlot` now race via the `afterLock` barrier — the SAME mechanism
 * the submit-vs-approve/submit-vs-close races already use — so each
 * direction below PROVES the second call genuinely blocked on Postgres's
 * row lock (not merely ran after the first completed). Both orderings are
 * asserted for their full linearization result: final Slot/Proposal/Event
 * rows, not just which promise settled how.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("race: approve vs close (4.13, pr2b-M5)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  async function setupOpenSlotWithProposal() {
    const { account: hospitalAccount, profile: hospital } = await createHospitalProfile(client);
    const { profile: artist } = await createArtistProfile(client);
    const slot = await createOpenSlot(client, hospital.id);
    const proposal = await createSubmittedProposal(client, slot.id, artist.id);
    const hospitalActor = actorFor(hospital, hospitalAccount.id, "hospital");
    return { hospitalActor, slot, proposal };
  }

  it("approve locks FIRST — commits accepted+published Event; close blocks then is denied", async () => {
    const { hospitalActor, slot, proposal } = await setupOpenSlotWithProposal();

    const approveHoldsLock = createDeferred<void>();
    const approveLockAcquired = createDeferred<void>();
    const approveUoW = new PrismaMatchingUnitOfWork(client, {
      afterLock: async () => {
        approveLockAcquired.resolve();
        await approveHoldsLock.promise;
      },
    });

    const approvePromise = approveProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: proposal.id },
      { ...slotDeps(client), matchingUnitOfWork: approveUoW },
    );

    await approveLockAcquired.promise;

    const closePromise = closeSlot(hospitalActor, { slotId: slot.id }, slotDeps(client));

    await waitForPostgresLockWait(client, "slots");
    approveHoldsLock.resolve();

    const [approveResult, closeResult] = await Promise.allSettled([approvePromise, closePromise]);

    expect(approveResult.status).toBe("fulfilled");
    expect(closeResult.status).toBe("rejected");
    expect((closeResult as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("FILLED");
    const finalProposal = await client.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(finalProposal.status).toBe("ACCEPTED");
    const events = await client.event.findMany({ where: { slotId: slot.id } });
    expect(events).toHaveLength(1);
  });

  it("close locks FIRST (the OTHER linearization) — commits closed+cascade-rejected; approve blocks then is denied", async () => {
    const { hospitalActor, slot, proposal } = await setupOpenSlotWithProposal();

    const closeHoldsLock = createDeferred<void>();
    const closeLockAcquired = createDeferred<void>();
    const closeUoW = new PrismaMatchingUnitOfWork(client, {
      afterLock: async () => {
        closeLockAcquired.resolve();
        await closeHoldsLock.promise;
      },
    });

    const closePromise = closeSlot(
      hospitalActor,
      { slotId: slot.id },
      { ...slotDeps(client), matchingUnitOfWork: closeUoW },
    );

    await closeLockAcquired.promise;

    const approvePromise = approveProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: proposal.id },
      slotDeps(client),
    );

    await waitForPostgresLockWait(client, "slots");
    closeHoldsLock.resolve();

    const [closeResult, approveResult] = await Promise.allSettled([closePromise, approvePromise]);

    expect(closeResult.status).toBe("fulfilled");
    expect(approveResult.status).toBe("rejected");
    expect((approveResult as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("CLOSED");
    const finalProposal = await client.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(finalProposal.status).toBe("REJECTED"); // closeSlot's cascade.
    const events = await client.event.findMany({ where: { slotId: slot.id } });
    expect(events).toHaveLength(0);
  });
});
