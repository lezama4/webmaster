import { beforeEach, describe, expect, it } from "vitest";
import { approveProposal } from "@application/use-cases/approveProposal";
import { rejectProposal } from "@application/use-cases/rejectProposal";
import { ConflictError } from "@application/errors";
import { PrismaMatchingUnitOfWork } from "@infrastructure/persistence/prisma/MatchingUnitOfWork";
import { createDeferred, tick } from "./support/barrier";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import {
  createArtistProfile,
  createHospitalProfile,
  createOpenSlot,
  createSubmittedProposal,
} from "./support/fixtures";
import { actorFor, slotDeps } from "./support/wiring";

/**
 * Task 4.14 (M1 pr2-review). pr2b-M5 strengthening: `approveProposal` and
 * `rejectProposal` targeting the SAME Proposal now race via the
 * `afterLock` barrier, forcing a genuine Postgres lock-wait interleave in
 * BOTH directions and asserting the full linearization result for each.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("race: approve vs reject (4.14, pr2b-M5)", () => {
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

  it("approve locks FIRST — commits accepted+published Event; reject blocks then is denied", async () => {
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

    const rejectPromise = rejectProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: proposal.id },
      slotDeps(client),
    );

    await tick();
    approveHoldsLock.resolve();

    const [approveResult, rejectResult] = await Promise.allSettled([approvePromise, rejectPromise]);

    expect(approveResult.status).toBe("fulfilled");
    expect(rejectResult.status).toBe("rejected");
    expect((rejectResult as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const finalProposal = await client.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(finalProposal.status).toBe("ACCEPTED");
    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("FILLED");
    const events = await client.event.findMany({ where: { slotId: slot.id } });
    expect(events).toHaveLength(1);
  });

  it("reject locks FIRST (the OTHER linearization) — commits rejected; approve blocks then is denied", async () => {
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

    const approvePromise = approveProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: proposal.id },
      slotDeps(client),
    );

    await tick();
    rejectHoldsLock.resolve();

    const [rejectResult, approveResult] = await Promise.allSettled([rejectPromise, approvePromise]);

    expect(rejectResult.status).toBe("fulfilled");
    expect(approveResult.status).toBe("rejected");
    expect((approveResult as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const finalProposal = await client.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(finalProposal.status).toBe("REJECTED");
    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("OPEN"); // manual rejection never fills the Slot.
    const events = await client.event.findMany({ where: { slotId: slot.id } });
    expect(events).toHaveLength(0);
  });
});
