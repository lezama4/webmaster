import { beforeEach, describe, expect, it } from "vitest";
import { submitProposal } from "@application/use-cases/submitProposal";
import { ConflictError } from "@application/errors";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import { createArtistProfile, createHospitalProfile, createOpenSlot } from "./support/fixtures";
import { actorFor, slotDeps } from "./support/wiring";

/**
 * Task 4.16 (M2 DECISION, pr2-review): two concurrent `submitProposal`
 * calls by the SAME Artist against the SAME open Slot. The Slot row lock
 * (D4) fully serializes them — the second re-reads the live Proposal set
 * (now including the first's insert) and its own duplicate guard denies
 * it with `ConflictError` BEFORE any insert is attempted, never surfacing
 * a raw Postgres unique-constraint error to the caller. The partial
 * unique index (`proposals_submitted_per_slot_artist`, B1) is exercised as
 * pure belt-and-braces here — the lock-first guard is what actually
 * prevents the race.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("race: duplicate same-Artist submission (4.16)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("persists exactly one submitted Proposal and denies the second attempt", async () => {
    const { profile: hospital } = await createHospitalProfile(client);
    const { profile: artist } = await createArtistProfile(client);
    const slot = await createOpenSlot(client, hospital.id);

    const artistActor = actorFor(artist, "artist-account-unused", "artist");
    const deps = slotDeps(client);

    const [first, second] = await Promise.allSettled([
      submitProposal(artistActor, { slotId: slot.id, message: "First attempt" }, deps),
      submitProposal(artistActor, { slotId: slot.id, message: "Second attempt" }, deps),
    ]);

    const outcomes = [first, second];
    const fulfilled = outcomes.filter((r) => r.status === "fulfilled");
    const rejected = outcomes.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const proposals = await client.proposal.findMany({
      where: { slotId: slot.id, artistProfileId: artist.id },
    });
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.status).toBe("SUBMITTED");
  });
});
