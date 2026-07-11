import { beforeEach, describe, expect, it } from "vitest";
import { approveProposal } from "@application/use-cases/approveProposal";
import { closeSlot } from "@application/use-cases/closeSlot";
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
 * Task 4.13 (M2 pr2-review): `approveProposal` and `closeSlot` fired
 * concurrently against the SAME Slot. Real row-level locking serializes
 * them — whichever transaction's `SELECT ... FOR UPDATE` is granted first
 * commits its full outcome; the other observes the updated, locked Slot
 * and is denied with `ConflictError`. Exactly ONE coherent outcome must
 * persist, never a contradictory success from both.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("race: approve vs close (4.13)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("commits exactly one coherent outcome", async () => {
    const { account: hospitalAccount, profile: hospital } = await createHospitalProfile(client);
    const { profile: artist } = await createArtistProfile(client);
    const slot = await createOpenSlot(client, hospital.id);
    const proposal = await createSubmittedProposal(client, slot.id, artist.id);

    const hospitalActor = actorFor(hospital, hospitalAccount.id, "hospital");
    const deps = slotDeps(client);

    const [approveResult, closeResult] = await Promise.allSettled([
      approveProposal(hospitalActor, { slotId: slot.id, proposalId: proposal.id }, deps),
      closeSlot(hospitalActor, { slotId: slot.id }, deps),
    ]);

    const outcomes = [approveResult, closeResult];
    const fulfilled = outcomes.filter((r) => r.status === "fulfilled");
    const rejected = outcomes.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    // Coherent final state — either the approve won (filled) or the close
    // won (closed), never both, never a third/contradictory status.
    expect(["FILLED", "CLOSED"]).toContain(finalSlot.status);

    const finalProposal = await client.proposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    if (finalSlot.status === "FILLED") {
      expect(finalProposal.status).toBe("ACCEPTED");
      const events = await client.event.findMany({ where: { slotId: slot.id } });
      expect(events).toHaveLength(1);
    } else {
      expect(finalProposal.status).toBe("REJECTED"); // closeSlot's cascade.
      const events = await client.event.findMany({ where: { slotId: slot.id } });
      expect(events).toHaveLength(0);
    }
  });
});
