import { beforeEach, describe, expect, it } from "vitest";
import { closeSlot } from "@application/use-cases/closeSlot";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import {
  createArtistProfile,
  createHospitalProfile,
  createOpenSlot,
  createSubmittedProposal,
} from "./support/fixtures";
import { actorFor, slotDeps } from "./support/wiring";

/**
 * Task 4.17 (B2 pr2-review): closing an open Slot with outstanding
 * `submitted` Proposals persists the cascade ATOMICALLY — Slot `closed`
 * AND every `submitted` Proposal `rejected`, in the same transaction.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("closeSlot cascade persistence (4.17, B2)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("transitions the Slot to closed and cascade-rejects every submitted Proposal", async () => {
    const { account: hospitalAccount, profile: hospital } = await createHospitalProfile(client);
    const { profile: clara } = await createArtistProfile(client, { name: "Clara" });
    const { profile: mateo } = await createArtistProfile(client, { name: "Mateo" });
    const slot = await createOpenSlot(client, hospital.id);
    await createSubmittedProposal(client, slot.id, clara.id);
    await createSubmittedProposal(client, slot.id, mateo.id);

    const hospitalActor = actorFor(hospital, hospitalAccount.id, "hospital");
    await closeSlot(hospitalActor, { slotId: slot.id }, slotDeps(client));

    const finalSlot = await client.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(finalSlot.status).toBe("CLOSED");

    const proposals = await client.proposal.findMany({ where: { slotId: slot.id } });
    expect(proposals).toHaveLength(2);
    for (const p of proposals) {
      expect(p.status).toBe("REJECTED");
    }
  });
});
