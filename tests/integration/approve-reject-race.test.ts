import { beforeEach, describe, expect, it } from "vitest";
import { approveProposal } from "@application/use-cases/approveProposal";
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
 * Task 4.14 (M1 pr2-review): `approveProposal` and `rejectProposal` fired
 * concurrently against the SAME Proposal. One coherent serial outcome must
 * persist — the loser observes the Proposal already terminal (accepted or
 * rejected) and is denied with `ConflictError`, never a contradictory
 * success from both.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("race: approve vs reject (4.14)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("commits exactly one coherent outcome on the same Proposal", async () => {
    const { account: hospitalAccount, profile: hospital } = await createHospitalProfile(client);
    const { profile: artist } = await createArtistProfile(client);
    const slot = await createOpenSlot(client, hospital.id);
    const proposal = await createSubmittedProposal(client, slot.id, artist.id);

    const hospitalActor = actorFor(hospital, hospitalAccount.id, "hospital");
    const deps = slotDeps(client);

    const [approveResult, rejectResult] = await Promise.allSettled([
      approveProposal(hospitalActor, { slotId: slot.id, proposalId: proposal.id }, deps),
      rejectProposal(hospitalActor, { slotId: slot.id, proposalId: proposal.id }, deps),
    ]);

    const outcomes = [approveResult, rejectResult];
    const fulfilled = outcomes.filter((r) => r.status === "fulfilled");
    const rejectedCalls = outcomes.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejectedCalls).toHaveLength(1);
    expect((rejectedCalls[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const finalProposal = await client.proposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(["ACCEPTED", "REJECTED"]).toContain(finalProposal.status);

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    if (finalProposal.status === "ACCEPTED") {
      expect(finalSlot.status).toBe("FILLED");
      const events = await client.event.findMany({ where: { slotId: slot.id } });
      expect(events).toHaveLength(1);
    } else {
      // Manual rejection won: the Slot stays open, no Event is created.
      expect(finalSlot.status).toBe("OPEN");
      const events = await client.event.findMany({ where: { slotId: slot.id } });
      expect(events).toHaveLength(0);
    }
  });
});
