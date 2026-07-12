import { beforeEach, describe, expect, it } from "vitest";
import { closeSlot } from "@application/use-cases/closeSlot";
import { rejectProposal } from "@application/use-cases/rejectProposal";
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
 * Task 4.15 (M1 pr2-review). pr2b-M5 strengthening: `closeSlot` and
 * `rejectProposal` targeting a Proposal on the SAME Slot now race via the
 * `afterLock` barrier in BOTH directions, forcing a genuine Postgres
 * lock-wait interleave rather than relying on ordinary scheduling. Both
 * orderings converge to the SAME coherent final state (Slot `closed`,
 * Proposal `rejected`) — that convergence is itself the property under
 * test, not an accident of which one happened to run first.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("race: close vs reject (4.15, pr2b-M5)", () => {
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

  it("close locks FIRST — its cascade rejects the Proposal; the late manual reject blocks then observes it already terminal", async () => {
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

    const rejectPromise = rejectProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: proposal.id },
      slotDeps(client),
    );

    await waitForPostgresLockWait(client, "slots");
    closeHoldsLock.resolve();

    const [closeResult, rejectResult] = await Promise.allSettled([closePromise, rejectPromise]);

    expect(closeResult.status).toBe("fulfilled");
    expect(rejectResult.status).toBe("rejected");
    expect((rejectResult as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("CLOSED");
    const finalProposal = await client.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(finalProposal.status).toBe("REJECTED");
  });

  it("manual reject locks FIRST (the OTHER linearization) — commits rejected; close blocks then its cascade finds nothing left to reject", async () => {
    const { hospitalActor, slot, proposal } = await setupOpenSlotWithProposal();

    const rejectHoldsLock = createDeferred<void>();
    const rejectLockAcquired = createDeferred<void>();
    const rejectUoW = new PrismaMatchingUnitOfWork(client, {
      afterLock: async () => {
        rejectLockAcquired.resolve();
        await rejectHoldsLock.promise;
      },
    });

    const rejectPromise = rejectProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: proposal.id },
      { ...slotDeps(client), matchingUnitOfWork: rejectUoW },
    );

    await rejectLockAcquired.promise;

    const closePromise = closeSlot(hospitalActor, { slotId: slot.id }, slotDeps(client));

    await waitForPostgresLockWait(client, "slots");
    rejectHoldsLock.resolve();

    const [rejectResult, closeResult] = await Promise.allSettled([rejectPromise, closePromise]);

    // Both orderings converge to the SAME coherent final state. Unlike the
    // OTHER direction (close-locks-first denies the late reject, because
    // close's own cascade races the Proposal's `submitted -> rejected`
    // transition reject also wants), a manual reject never touches the
    // Slot row's status — so close's own guard (Slot still `open`) always
    // passes here, and its cascade simply re-reads the live Proposal set
    // inside its own lock and finds nothing left to cascade (the manual
    // reject already committed). Both calls fulfil in this ordering.
    expect(rejectResult.status).toBe("fulfilled");
    expect(closeResult.status).toBe("fulfilled");

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("CLOSED");
    const finalProposal = await client.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(finalProposal.status).toBe("REJECTED");
  });
});
