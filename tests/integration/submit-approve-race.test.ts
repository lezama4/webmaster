import { beforeEach, describe, expect, it } from "vitest";
import { approveProposal } from "@application/use-cases/approveProposal";
import { submitProposal } from "@application/use-cases/submitProposal";
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
 * Task 4.11 (B1/B2 pr2-review): barrier-based interleave of `approveProposal`
 * (holds the Slot lock first, via `afterLock`) and a late `submitProposal`
 * by a THIRD Artist for the SAME Slot. The late submit's own
 * `SELECT ... FOR UPDATE` genuinely blocks at the Postgres level until
 * approve's transaction commits — proving the lock-first ordering (D4),
 * not merely a JS-level Promise race. Once approve commits (Slot -> filled)
 * the late submit MUST be denied with `ConflictError`.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("race: submit vs approve (4.11)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("denies a submit that arrives after approve has locked the Slot", async () => {
    const { account: hospitalAccount, profile: hospital } = await createHospitalProfile(client);
    const { profile: clara } = await createArtistProfile(client, { name: "Clara" });
    const { account: mateoAccount, profile: mateo } = await createArtistProfile(client, {
      name: "Mateo",
    });
    const slot = await createOpenSlot(client, hospital.id);
    const claraProposal = await createSubmittedProposal(client, slot.id, clara.id);

    const approveHoldsLock = createDeferred<void>();
    const approveLockAcquired = createDeferred<void>();

    const approveUoW = new PrismaMatchingUnitOfWork(client, {
      afterLock: async () => {
        approveLockAcquired.resolve();
        await approveHoldsLock.promise;
      },
    });

    const hospitalActor = actorFor(hospital, hospitalAccount.id, "centre");
    const mateoActor = actorFor(mateo, mateoAccount.id, "artist");

    const approvePromise = approveProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: claraProposal.id },
      { ...slotDeps(client), matchingUnitOfWork: approveUoW },
    );

    await approveLockAcquired.promise; // approve now holds the row lock.

    const submitPromise = submitProposal(
      mateoActor,
      { slotId: slot.id, message: "Too late, hopefully" },
      slotDeps(client),
    );

    await waitForPostgresLockWait(client, "slots");
    approveHoldsLock.resolve(); // release approve — it commits, filling the Slot.

    const [approveResult, submitResult] = await Promise.allSettled([
      approvePromise,
      submitPromise,
    ]);

    expect(approveResult.status).toBe("fulfilled");
    expect(submitResult.status).toBe("rejected");
    expect((submitResult as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("FILLED");

    const proposals = await client.proposal.findMany({ where: { slotId: slot.id } });
    // Only Clara's original Proposal exists — Mateo's late submit never persisted.
    expect(proposals.map((p) => p.artistProfileId)).toEqual([clara.id]);
    expect(proposals[0]!.status).toBe("ACCEPTED");
  });

  it("submit locks FIRST — approval waits, then accepts its target and cascade-rejects the already-committed late proposal", async () => {
    const { account: hospitalAccount, profile: hospital } = await createHospitalProfile(client);
    const { profile: clara } = await createArtistProfile(client, { name: "Clara" });
    const { account: mateoAccount, profile: mateo } = await createArtistProfile(client, {
      name: "Mateo",
    });
    const slot = await createOpenSlot(client, hospital.id);
    const claraProposal = await createSubmittedProposal(client, slot.id, clara.id);

    const submitHoldsLock = createDeferred<void>();
    const submitLockAcquired = createDeferred<void>();
    const submitUoW = new PrismaMatchingUnitOfWork(client, {
      afterLock: async () => {
        submitLockAcquired.resolve();
        await submitHoldsLock.promise;
      },
    });

    const hospitalActor = actorFor(hospital, hospitalAccount.id, "centre");
    const mateoActor = actorFor(mateo, mateoAccount.id, "artist");
    const submitPromise = submitProposal(
      mateoActor,
      { slotId: slot.id, message: "Submitted before approval" },
      { ...slotDeps(client), matchingUnitOfWork: submitUoW },
    );

    await submitLockAcquired.promise;

    const approvePromise = approveProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: claraProposal.id },
      slotDeps(client),
    );

    await waitForPostgresLockWait(client, "slots");
    submitHoldsLock.resolve();

    const [submitResult, approveResult] = await Promise.allSettled([
      submitPromise,
      approvePromise,
    ]);

    expect(submitResult.status).toBe("fulfilled");
    expect(approveResult.status).toBe("fulfilled");

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("FILLED");
    const proposals = await client.proposal.findMany({ where: { slotId: slot.id } });
    expect(proposals).toHaveLength(2);
    expect(proposals.find((proposal) => proposal.id === claraProposal.id)?.status).toBe(
      "ACCEPTED",
    );
    expect(proposals.find((proposal) => proposal.artistProfileId === mateo.id)?.status).toBe(
      "REJECTED",
    );
  });
});
