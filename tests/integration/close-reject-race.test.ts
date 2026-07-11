import { beforeEach, describe, expect, it } from "vitest";
import { closeSlot } from "@application/use-cases/closeSlot";
import { rejectProposal } from "@application/use-cases/rejectProposal";
import { ConflictError } from "@application/errors";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import {
  createArtistProfile,
  createHospitalProfile,
  createOpenSlot,
  createSubmittedProposal,
} from "./support/fixtures";
import { actorFor, slotDeps } from "./support/wiring";

/**
 * Task 4.15 (M1 pr2-review): `closeSlot` and `rejectProposal` fired
 * concurrently, targeting a Proposal on the SAME Slot. Depending on which
 * transaction's lock is granted first, EITHER both calls succeed
 * harmlessly (manual reject commits, then close's cascade finds nothing
 * left `submitted`) OR the second observes the Proposal already
 * `rejected` (by the other's cascade) and is denied with `ConflictError`.
 * Both orderings are coherent; what must NEVER happen is a corrupted final
 * state (Proposal not `rejected`, Slot not `closed`, or an unexpected
 * error type).
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("race: close vs reject (4.15)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("always ends with the Slot closed and the Proposal rejected", async () => {
    const { account: hospitalAccount, profile: hospital } = await createHospitalProfile(client);
    const { profile: artist } = await createArtistProfile(client);
    const slot = await createOpenSlot(client, hospital.id);
    const proposal = await createSubmittedProposal(client, slot.id, artist.id);

    const hospitalActor = actorFor(hospital, hospitalAccount.id, "hospital");
    const deps = slotDeps(client);

    const [closeResult, rejectResult] = await Promise.allSettled([
      closeSlot(hospitalActor, { slotId: slot.id }, deps),
      rejectProposal(hospitalActor, { slotId: slot.id, proposalId: proposal.id }, deps),
    ]);

    // Any rejection MUST be a ConflictError — never a raw/unexpected error.
    for (const outcome of [closeResult, rejectResult]) {
      if (outcome.status === "rejected") {
        expect(outcome.reason).toBeInstanceOf(ConflictError);
      }
    }

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("CLOSED");

    const finalProposal = await client.proposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(finalProposal.status).toBe("REJECTED");
  });
});
