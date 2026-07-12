import { beforeEach, describe, expect, it } from "vitest";
import { submitProposal } from "@application/use-cases/submitProposal";
import { ConflictError } from "@application/errors";
import { PrismaMatchingUnitOfWork } from "@infrastructure/persistence/prisma/MatchingUnitOfWork";
import { createDeferred, waitForPostgresLockWait } from "./support/barrier";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import { createArtistProfile, createHospitalProfile, createOpenSlot } from "./support/fixtures";
import { actorFor, slotDeps } from "./support/wiring";

/**
 * Task 4.16 (M2 DECISION, pr2-review). pr2b-M5 strengthening: two
 * concurrent `submitProposal` calls by the SAME Artist against the SAME
 * open Slot now race via the `afterLock` barrier — forcing the SECOND
 * call's own `SELECT ... FOR UPDATE` to genuinely block on Postgres until
 * the FIRST commits, rather than relying on ordinary Node scheduling to
 * happen to serialize two `Promise.allSettled` calls the same way. Both
 * "first attempt"/"second attempt" labels below are forced deterministic
 * by the barrier — the OTHER labelling is symmetric (either message could
 * be "first" to lock; the guard's behaviour does not depend on which).
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("race: duplicate same-Artist submission (4.16, pr2b-M5)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("persists exactly the FIRST-locked submission and denies the late-arriving one with ConflictError, never a raw DB error", async () => {
    const { profile: hospital } = await createHospitalProfile(client);
    const { account: artistAccount, profile: artist } = await createArtistProfile(client);
    const slot = await createOpenSlot(client, hospital.id);
    const artistActor = actorFor(artist, artistAccount.id, "artist");

    const firstHoldsLock = createDeferred<void>();
    const firstLockAcquired = createDeferred<void>();
    const firstUoW = new PrismaMatchingUnitOfWork(client, {
      afterLock: async () => {
        firstLockAcquired.resolve();
        await firstHoldsLock.promise;
      },
    });

    const firstPromise = submitProposal(
      artistActor,
      { slotId: slot.id, message: "First attempt (locked first, by construction)" },
      { ...slotDeps(client), matchingUnitOfWork: firstUoW },
    );

    await firstLockAcquired.promise; // the first submit now holds the row lock.

    const secondPromise = submitProposal(
      artistActor,
      { slotId: slot.id, message: "Second attempt (arrives while locked)" },
      slotDeps(client),
    );

    await waitForPostgresLockWait(client, "slots");
    firstHoldsLock.resolve(); // release the first — it commits.

    const [firstResult, secondResult] = await Promise.allSettled([firstPromise, secondPromise]);

    expect(firstResult.status).toBe("fulfilled");
    expect(secondResult.status).toBe("rejected");
    expect((secondResult as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const proposals = await client.proposal.findMany({
      where: { slotId: slot.id, artistProfileId: artist.id },
    });
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.status).toBe("SUBMITTED");
    expect(proposals[0]!.message).toBe("First attempt (locked first, by construction)");
  });

  it("is symmetric: whichever of the two calls the caller happens to construct the barrier around still wins deterministically", async () => {
    const { profile: hospital } = await createHospitalProfile(client);
    const { account: artistAccount, profile: artist } = await createArtistProfile(client);
    const slot = await createOpenSlot(client, hospital.id);
    const artistActor = actorFor(artist, artistAccount.id, "artist");

    // Same mechanism, roles swapped relative to the test above — proves
    // the guard's outcome depends on LOCK ORDER, not on argument order or
    // any other incidental JS-level scheduling detail.
    const secondHoldsLock = createDeferred<void>();
    const secondLockAcquired = createDeferred<void>();
    const secondUoW = new PrismaMatchingUnitOfWork(client, {
      afterLock: async () => {
        secondLockAcquired.resolve();
        await secondHoldsLock.promise;
      },
    });

    const secondPromise = submitProposal(
      artistActor,
      { slotId: slot.id, message: "Locked first this time" },
      { ...slotDeps(client), matchingUnitOfWork: secondUoW },
    );

    await secondLockAcquired.promise;

    const firstPromise = submitProposal(
      artistActor,
      { slotId: slot.id, message: "Arrives while locked, this time" },
      slotDeps(client),
    );

    await waitForPostgresLockWait(client, "slots");
    secondHoldsLock.resolve();

    const [secondResult, firstResult] = await Promise.allSettled([secondPromise, firstPromise]);

    expect(secondResult.status).toBe("fulfilled");
    expect(firstResult.status).toBe("rejected");
    expect((firstResult as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const proposals = await client.proposal.findMany({
      where: { slotId: slot.id, artistProfileId: artist.id },
    });
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.message).toBe("Locked first this time");
  });
});
