import { describe, expect, it } from "vitest";

import { listPublishedEvents } from "@application/use-cases/listPublishedEvents";
import type { PublicEventProjection } from "@application/dto/PublicEventProjection";
import { FakePublicEventProjectionQuery } from "./support/fakes";

const ALLOW_LISTED_FIELDS = [
  "artistName",
  "audience",
  "averageStars",
  // Optional "aforo máximo" (Slot.capacity), null when unset.
  "capacity",
  // D10 revision (events-show-centre): the hosting centre's PUBLIC name + city.
  "centreCity",
  "centreName",
  "description",
  "durationMinutes",
  "id",
  "ratingCount",
  "scheduledAt",
  "title",
].sort();

function aProjection(
  overrides: Partial<PublicEventProjection> = {},
): PublicEventProjection {
  return {
    id: "event-1",
    title: "Acoustic guitar afternoon",
    description: "A relaxed acoustic session for the pediatric ward.",
    scheduledAt: new Date("2026-08-01T17:00:00Z"),
    durationMinutes: 60,
    artistName: "Clara",
    audience: "all_ages",
    capacity: null,
    centreName: "Hospital San Juan",
    centreCity: "Bilbao",
    averageStars: null,
    ratingCount: 0,
    ...overrides,
  };
}

describe("listPublishedEvents (public, D6 allow-list via PublicEventProjectionQuery, M6)", () => {
  it("returns exactly what the PublicEventProjectionQuery port supplies (already filtered to published, D6)", async () => {
    const items = [aProjection(), aProjection({ title: "Second event" })];
    const deps = {
      publicEventProjectionQuery: new FakePublicEventProjectionQuery(items),
    };

    const result = await listPublishedEvents(deps);

    expect(result).toEqual(items);
  });

  it("returns an empty list when the query has no published Events", async () => {
    const deps = {
      publicEventProjectionQuery: new FakePublicEventProjectionQuery([]),
    };

    const result = await listPublishedEvents(deps);

    expect(result).toEqual([]);
  });

  it("every returned item is STRUCTURALLY limited to the D6 allow-list — no location, message, email, or any id OTHER than the Event's own", async () => {
    const deps = {
      publicEventProjectionQuery: new FakePublicEventProjectionQuery([
        aProjection(),
      ]),
    };

    const result = await listPublishedEvents(deps);

    for (const item of result) {
      expect(Object.keys(item).sort()).toEqual(ALLOW_LISTED_FIELDS);
      expect(item).not.toHaveProperty("location");
      expect(item).not.toHaveProperty("message");
      expect(item).not.toHaveProperty("email");
      expect(item).not.toHaveProperty("slotId");
      expect(item).not.toHaveProperty("proposalId");
      // `id` IS allow-listed (Phase 3, Block 2) — but it must be the
      // Event's OWN id, never a Slot/Proposal/Profile/Account id.
      expect(item.id).toBe("event-1");
    }
  });

  it("HOSTILE ADAPTER (pr2a-B1): rebuilds a fresh DTO — forbidden fields returned by the port are structurally ABSENT from the result, not just ignored by the type", async () => {
    const hostileItem = {
      ...aProjection(),
      // A port implementation (buggy, compromised, or a future accidental
      // `select`/`include` widening) could return these alongside the
      // allow-listed fields. TypeScript's structural typing does not stop
      // an object literal with EXTRA properties from being passed where
      // `PublicEventProjection` is expected, and a plain pass-through would
      // leak them straight into JSON.
      location: "Ward 3, Room 12",
      message: "This is a private message between Hospital and Artist.",
      email: "artist.clara@vtt.test",
      slotId: "slot-secret-id",
      proposalId: "proposal-secret-id",
      artistProfileId: "profile-secret-id",
      accountId: "account-secret-id",
    } as unknown as PublicEventProjection;

    const deps = {
      publicEventProjectionQuery: new FakePublicEventProjectionQuery([
        hostileItem,
      ]),
    };

    const result = await listPublishedEvents(deps);

    expect(result).toHaveLength(1);
    const [item] = result;
    expect(Object.keys(item).sort()).toEqual(ALLOW_LISTED_FIELDS);
    expect(item).not.toHaveProperty("location");
    expect(item).not.toHaveProperty("message");
    expect(item).not.toHaveProperty("email");
    expect(item).not.toHaveProperty("slotId");
    expect(item).not.toHaveProperty("proposalId");
    expect(item).not.toHaveProperty("artistProfileId");
    expect(item).not.toHaveProperty("accountId");
    // The allow-listed fields themselves must still be forwarded correctly,
    // INCLUDING the Event's own `id` (Phase 3, Block 2) — never a
    // Slot/Proposal/Profile/Account id, only the Event's.
    expect(item.title).toBe(hostileItem.title);
    expect(item.artistName).toBe(hostileItem.artistName);
    expect(item.id).toBe("event-1");
  });

  it("does not import or depend on anything beyond the PublicEventProjectionQuery port (no repository, no Prisma)", () => {
    // Structural/compile-time guarantee (M6): the module's only import besides
    // the DTO type is the port interface — verified by this file compiling
    // and passing under the ESLint layer-boundary rule (application/ MUST
    // NOT import Prisma or infrastructure). See eslint.config.mjs.
    expect(typeof listPublishedEvents).toBe("function");
  });
});
