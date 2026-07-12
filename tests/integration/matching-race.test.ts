import { beforeEach, describe, expect, it } from "vitest";
import { approveProposal } from "@application/use-cases/approveProposal";
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
 * Task 4.10 (ADR D4/B2). pr2b-M5 strengthening: the original version fired
 * two `approveProposal` promises via `Promise.allSettled` with NO forced
 * ordering — real Postgres scheduling happened to serialize them, but
 * nothing in the test PROVED the second call genuinely blocked on the row
 * lock rather than simply running after the first had already committed.
 * Both directions below use the `afterLock` barrier (the same mechanism
 * the submit-vs-approve/submit-vs-close races already use) to force a
 * deterministic winner via a REAL Postgres lock wait, and assert the full
 * linearization result for BOTH possible orderings.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("matching race: approve vs approve (4.10, pr2b-M5)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  async function setupSlotWithTwoProposals() {
    const { account: hospitalAccount, profile: hospital } = await createHospitalProfile(client);
    const { profile: clara } = await createArtistProfile(client, { name: "Clara" });
    const { profile: mateo } = await createArtistProfile(client, { name: "Mateo" });
    const slot = await createOpenSlot(client, hospital.id);
    const claraProposal = await createSubmittedProposal(client, slot.id, clara.id);
    const mateoProposal = await createSubmittedProposal(client, slot.id, mateo.id);
    const hospitalActor = actorFor(hospital, hospitalAccount.id, "hospital");
    return { hospitalActor, slot, claraProposal, mateoProposal };
  }

  it("Clara's approve locks the Slot FIRST — commits accepted; Mateo's approve blocks then is denied", async () => {
    const { hospitalActor, slot, claraProposal, mateoProposal } =
      await setupSlotWithTwoProposals();

    const claraHoldsLock = createDeferred<void>();
    const claraLockAcquired = createDeferred<void>();
    const claraUoW = new PrismaMatchingUnitOfWork(client, {
      afterLock: async () => {
        claraLockAcquired.resolve();
        await claraHoldsLock.promise;
      },
    });

    const claraPromise = approveProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: claraProposal.id },
      { ...slotDeps(client), matchingUnitOfWork: claraUoW },
    );

    await claraLockAcquired.promise; // Clara's approve now holds the row lock.

    const mateoPromise = approveProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: mateoProposal.id },
      slotDeps(client),
    );

    await tick(); // let Mateo's SELECT ... FOR UPDATE actually reach Postgres and block.
    claraHoldsLock.resolve(); // release Clara's transaction — it commits, filling the Slot.

    const [claraResult, mateoResult] = await Promise.allSettled([claraPromise, mateoPromise]);

    expect(claraResult.status).toBe("fulfilled");
    expect(mateoResult.status).toBe("rejected");
    expect((mateoResult as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("FILLED");

    const finalClara = await client.proposal.findUniqueOrThrow({ where: { id: claraProposal.id } });
    const finalMateo = await client.proposal.findUniqueOrThrow({ where: { id: mateoProposal.id } });
    expect(finalClara.status).toBe("ACCEPTED");
    expect(finalMateo.status).toBe("SUBMITTED"); // Mateo's approve never persisted anything — it never got past the guard.

    const events = await client.event.findMany({ where: { slotId: slot.id } });
    expect(events).toHaveLength(1);
    expect(events[0]!.proposalId).toBe(claraProposal.id);
  });

  it("Mateo's approve locks the Slot FIRST (the OTHER linearization) — commits accepted; Clara's approve blocks then is denied", async () => {
    const { hospitalActor, slot, claraProposal, mateoProposal } =
      await setupSlotWithTwoProposals();

    const mateoHoldsLock = createDeferred<void>();
    const mateoLockAcquired = createDeferred<void>();
    const mateoUoW = new PrismaMatchingUnitOfWork(client, {
      afterLock: async () => {
        mateoLockAcquired.resolve();
        await mateoHoldsLock.promise;
      },
    });

    const mateoPromise = approveProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: mateoProposal.id },
      { ...slotDeps(client), matchingUnitOfWork: mateoUoW },
    );

    await mateoLockAcquired.promise;

    const claraPromise = approveProposal(
      hospitalActor,
      { slotId: slot.id, proposalId: claraProposal.id },
      slotDeps(client),
    );

    await tick();
    mateoHoldsLock.resolve();

    const [mateoResult, claraResult] = await Promise.allSettled([mateoPromise, claraPromise]);

    expect(mateoResult.status).toBe("fulfilled");
    expect(claraResult.status).toBe("rejected");
    expect((claraResult as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("FILLED");

    const finalClara = await client.proposal.findUniqueOrThrow({ where: { id: claraProposal.id } });
    const finalMateo = await client.proposal.findUniqueOrThrow({ where: { id: mateoProposal.id } });
    expect(finalMateo.status).toBe("ACCEPTED");
    expect(finalClara.status).toBe("SUBMITTED");

    const events = await client.event.findMany({ where: { slotId: slot.id } });
    expect(events).toHaveLength(1);
    expect(events[0]!.proposalId).toBe(mateoProposal.id);
  });
});
