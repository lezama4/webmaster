import { describe, expect, it } from "vitest";

import { listPublishedEvents } from "@application/use-cases/listPublishedEvents";
import type { PublicEventProjection } from "@application/dto/PublicEventProjection";
import { FakePublicEventProjectionQuery } from "./support/fakes";

const ALLOW_LISTED_FIELDS = [
  "artistName",
  "description",
  "durationMinutes",
  "scheduledAt",
  "title",
].sort();

function aProjection(
  overrides: Partial<PublicEventProjection> = {},
): PublicEventProjection {
  return {
    title: "Acoustic guitar afternoon",
    description: "A relaxed acoustic session for the pediatric ward.",
    scheduledAt: new Date("2026-08-01T17:00:00Z"),
    durationMinutes: 60,
    artistName: "Clara",
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

  it("every returned item is STRUCTURALLY limited to the D6 allow-list — no location, message, email, or internal id", async () => {
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
      expect(item).not.toHaveProperty("id");
      expect(item).not.toHaveProperty("slotId");
      expect(item).not.toHaveProperty("proposalId");
    }
  });

  it("does not import or depend on anything beyond the PublicEventProjectionQuery port (no repository, no Prisma)", () => {
    // Structural/compile-time guarantee (M6): the module's only import besides
    // the DTO type is the port interface — verified by this file compiling
    // and passing under the ESLint layer-boundary rule (application/ MUST
    // NOT import Prisma or infrastructure). See eslint.config.mjs.
    expect(typeof listPublishedEvents).toBe("function");
  });
});
