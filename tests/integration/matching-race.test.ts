import { beforeEach, describe, expect, it } from "vitest";
import { approveProposal } from "@application/use-cases/approveProposal";
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
 * Task 4.10 (ADR D4/B2): two concurrent `approveProposal` calls targeting
 * DIFFERENT Proposals on the SAME open Slot. Postgres's real row-level
 * `SELECT ... FOR UPDATE` lock (not an artificial JS-level delay) forces
 * one to fully commit before the other's lock is granted — exactly one
 * `accepted`, one `ConflictError` (the second observes the Slot already
 * `filled`), never two "successful" outcomes.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("matching race: approve vs approve (4.10)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("commits exactly one accept and denies the other with ConflictError", async () => {
    const { account: hospitalAccount, profile: hospital } = await createHospitalProfile(client);
    const { profile: clara } = await createArtistProfile(client, { name: "Clara" });
    const { profile: mateo } = await createArtistProfile(client, { name: "Mateo" });
    const slot = await createOpenSlot(client, hospital.id);
    const claraProposal = await createSubmittedProposal(client, slot.id, clara.id);
    const mateoProposal = await createSubmittedProposal(client, slot.id, mateo.id);

    const hospitalActor = actorFor(hospital, hospitalAccount.id, "hospital");
    const deps = slotDeps(client);

    const [claraOutcome, mateoOutcome] = await Promise.allSettled([
      approveProposal(hospitalActor, { slotId: slot.id, proposalId: claraProposal.id }, deps),
      approveProposal(hospitalActor, { slotId: slot.id, proposalId: mateoProposal.id }, deps),
    ]);

    const settled = [claraOutcome, mateoOutcome];
    const fulfilled = settled.filter((r) => r.status === "fulfilled");
    const rejected = settled.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    // Final DB state — not just return codes.
    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("FILLED");

    const proposals = await client.proposal.findMany({
      where: { slotId: slot.id },
      orderBy: { id: "asc" },
    });
    const accepted = proposals.filter((p) => p.status === "ACCEPTED");
    const rejectedRows = proposals.filter((p) => p.status === "REJECTED");
    expect(accepted).toHaveLength(1);
    expect(rejectedRows).toHaveLength(1);

    const events = await client.event.findMany({ where: { slotId: slot.id } });
    expect(events).toHaveLength(1);
    expect(events[0]!.status).toBe("PUBLISHED");
    expect(events[0]!.proposalId).toBe(accepted[0]!.id);
  });
});
