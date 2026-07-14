import { beforeEach, describe, expect, it } from "vitest";
import { createEvent, publishEvent } from "@domain/event/Event";
import { acceptProposal } from "@domain/proposal/Proposal";
import { PrismaEventRepository } from "@infrastructure/persistence/prisma/EventRepository";
import { PrismaProposalRepository } from "@infrastructure/persistence/prisma/ProposalRepository";
import { PrismaPublicEventProjectionQuery } from "@infrastructure/persistence/prisma/PublicEventProjectionQuery";
import { getTestPrismaClient, isDatabaseAvailable, resetDatabase } from "./support/db";
import {
  createArtistProfile,
  createHospitalProfile,
  createOpenSlot,
  createSubmittedProposal,
} from "./support/fixtures";

/**
 * Task 4.8 (M6 pr2-review, ADR D6): asserts the query returns ONLY the
 * allow-listed fields, filtered to `published` Events, against real
 * fixture data — the runtime boundary the pr2a review flagged (B1) as
 * merely a TypeScript promise in the application layer's fake-backed
 * tests. This is the ONE place permitted to join Event -> Slot -> Proposal
 * -> Profile (M6); the HTTP-level no-leak test stays PR 3/6.
 */
const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("PrismaPublicEventProjectionQuery (4.8)", () => {
  const client = getTestPrismaClient();

  beforeEach(async () => {
    await resetDatabase(client);
  });

  it("returns only the allow-listed fields for a published Event", async () => {
    const { profile: hospital } = await createHospitalProfile(client, {
      name: "San Juan Hospital",
    });
    const { profile: artist } = await createArtistProfile(client, {
      name: "Clara the Artist",
    });
    const slot = await createOpenSlot(client, hospital.id, {
      title: "Afternoon storytelling",
    });
    const proposal = acceptProposal(
      await createSubmittedProposal(client, slot.id, artist.id, {
        message: "PRIVATE — never expose this",
      }),
    );
    await new PrismaProposalRepository(client).save(proposal);

    const event = publishEvent(
      createEvent({
        id: "event-1",
        slotId: slot.id,
        proposalId: proposal.id,
        title: "Storytelling with Clara",
      }),
    );
    await new PrismaEventRepository(client).save(event);

    const query = new PrismaPublicEventProjectionQuery(client);
    const results = await query.listPublished();

    expect(results).toHaveLength(1);
    const projection = results[0]!;
    expect(projection).toEqual({
      title: "Storytelling with Clara",
      description: slot.description,
      scheduledAt: slot.scheduledAt,
      durationMinutes: slot.durationMinutes,
      artistName: "Clara the Artist",
      audience: "all_ages",
    });
    // Structural allow-list assertion: no forbidden key ever appears.
    expect(Object.keys(projection).sort()).toEqual(
      ["artistName", "audience", "description", "durationMinutes", "scheduledAt", "title"].sort(),
    );
  });

  it("excludes Events that are not published", async () => {
    const { profile: hospital } = await createHospitalProfile(client);
    const { profile: artist } = await createArtistProfile(client);
    const slot = await createOpenSlot(client, hospital.id);
    const proposal = acceptProposal(
      await createSubmittedProposal(client, slot.id, artist.id),
    );
    await new PrismaProposalRepository(client).save(proposal);

    // `created`, never published.
    await new PrismaEventRepository(client).save(
      createEvent({
        id: "event-unpublished",
        slotId: slot.id,
        proposalId: proposal.id,
        title: "Not yet public",
      }),
    );

    const query = new PrismaPublicEventProjectionQuery(client);
    const results = await query.listPublished();
    expect(results).toHaveLength(0);
  });
});
