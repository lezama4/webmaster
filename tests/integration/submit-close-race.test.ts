import { beforeEach, describe, expect, it } from "vitest";
import { closeSlot } from "@application/use-cases/closeSlot";
import { submitProposal } from "@application/use-cases/submitProposal";
import { ConflictError } from "@application/errors";
import { PrismaMatchingUnitOfWork } from "@infrastructure/persistence/prisma/MatchingUnitOfWork";
import { createDeferred, waitForPostgresLockWait } from "./support/barrier";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import { createArtistProfile, createHospitalProfile, createOpenSlot } from "./support/fixtures";
import { actorFor, slotDeps } from "./support/wiring";

/**
 * Task 4.12 (M2 pr2-review): barrier-based interleave of `closeSlot`
 * (holds the lock first) and a late `submitProposal` on the same Slot —
 * once close commits (Slot -> closed), the late submit is denied.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("race: submit vs close (4.12)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("denies a submit that arrives after close has locked the Slot", async () => {
    const { account: hospitalAccount, profile: hospital } = await createHospitalProfile(client);
    const { profile: artist } = await createArtistProfile(client);
    const slot = await createOpenSlot(client, hospital.id);

    const closeHoldsLock = createDeferred<void>();
    const closeLockAcquired = createDeferred<void>();

    const closeUoW = new PrismaMatchingUnitOfWork(client, {
      afterLock: async () => {
        closeLockAcquired.resolve();
        await closeHoldsLock.promise;
      },
    });

    const hospitalActor = actorFor(hospital, hospitalAccount.id, "hospital");
    const artistActor = actorFor(artist, "artist-account-unused", "artist");

    const closePromise = closeSlot(
      hospitalActor,
      { slotId: slot.id },
      { ...slotDeps(client), matchingUnitOfWork: closeUoW },
    );

    await closeLockAcquired.promise;

    const submitPromise = submitProposal(
      artistActor,
      { slotId: slot.id, message: "Too late" },
      slotDeps(client),
    );

    await waitForPostgresLockWait(client, "slots");
    closeHoldsLock.resolve();

    const [closeResult, submitResult] = await Promise.allSettled([closePromise, submitPromise]);

    expect(closeResult.status).toBe("fulfilled");
    expect(submitResult.status).toBe("rejected");
    expect((submitResult as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("CLOSED");

    const proposals = await client.proposal.findMany({ where: { slotId: slot.id } });
    expect(proposals).toHaveLength(0); // the late submit never persisted.
  });

  it("submit locks FIRST — close waits, then closes the Slot and cascade-rejects that submission", async () => {
    const { account: hospitalAccount, profile: hospital } = await createHospitalProfile(client);
    const { profile: artist } = await createArtistProfile(client);
    const slot = await createOpenSlot(client, hospital.id);

    const submitHoldsLock = createDeferred<void>();
    const submitLockAcquired = createDeferred<void>();
    const submitUoW = new PrismaMatchingUnitOfWork(client, {
      afterLock: async () => {
        submitLockAcquired.resolve();
        await submitHoldsLock.promise;
      },
    });

    const hospitalActor = actorFor(hospital, hospitalAccount.id, "hospital");
    const artistActor = actorFor(artist, "artist-account-unused", "artist");
    const submitPromise = submitProposal(
      artistActor,
      { slotId: slot.id, message: "Submitted before closure" },
      { ...slotDeps(client), matchingUnitOfWork: submitUoW },
    );

    await submitLockAcquired.promise;

    const closePromise = closeSlot(
      hospitalActor,
      { slotId: slot.id },
      slotDeps(client),
    );

    await waitForPostgresLockWait(client, "slots");
    submitHoldsLock.resolve();

    const [submitResult, closeResult] = await Promise.allSettled([
      submitPromise,
      closePromise,
    ]);

    expect(submitResult.status).toBe("fulfilled");
    expect(closeResult.status).toBe("fulfilled");
    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("CLOSED");
    const proposals = await client.proposal.findMany({ where: { slotId: slot.id } });
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.status).toBe("REJECTED");
  });
});
