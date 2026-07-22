/**
 * D10 non-correlation invariant — DEDICATED OWNER FILE.
 *
 * If you are here because a test failed after you added a field, you are
 * changing ADR D10. Read it before editing this list.
 *
 * The invariant: someone browsing both public surfaces must not be able to
 * infer that a given hospital hosts a given event. Each individual fact is
 * harmless in isolation — a hospital participates; an event happens on
 * Tuesday. THE JOIN IS THE LEAK. Neither `PublicHospitalProjection` nor
 * `PublicEventProjection` can enforce this alone: each one, inspected by
 * itself, looks perfectly innocent. That is why this property gets its own
 * file, importing BOTH use cases and asserting the relation from the
 * OUTSIDE — see design.md D10 for the full threat model (the "helpful
 * badge" scenario) and the enforcement-layer table.
 */
import { describe, expect, it } from "vitest";

import { listPublicHospitals } from "@application/use-cases/listPublicHospitals";
import { listPublishedEvents } from "@application/use-cases/listPublishedEvents";
import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";
import type { PublicEventProjection } from "@application/dto/PublicEventProjection";
import {
  FakePublicEventProjectionQuery,
  FakePublicHospitalDirectoryQuery,
} from "./support/fakes";

const HOSPITAL_ALLOW_LISTED_FIELDS = [
  "city",
  "latitude",
  "longitude",
  "name",
  "postalCode",
].sort();

/**
 * Every field the public Event surface may carry.
 *
 * Deliberately duplicated rather than derived from `PublicEventProjection`:
 * deriving it would validate the type against itself and assert nothing, so
 * a widening of the projection has to be typed out HERE, by a person, on
 * purpose. That is the whole mechanism — do not "DRY" this away.
 *
 * The last three were added by Block 2 (event ratings) and are admitted
 * after checking each against D10 specifically, not merely against D6:
 *
 * - `id` is the EVENT's own id, needed so a client can POST a rating. It is
 *   NOT the Slot id — the Slot is what belongs to a hospital — nor the
 *   Proposal, Profile or Account id. It reveals nothing about where the
 *   event happens.
 * - `averageStars` / `ratingCount` are an aggregate over the event itself.
 *   Individual ratings and rater identity stay out, so neither can be
 *   correlated back to a hospital or to a person.
 *
 * If a future field cannot survive that same paragraph, it does not belong
 * on this list.
 */
const EVENT_ALLOW_LISTED_FIELDS = [
  "artistName",
  "audience",
  "averageStars",
  "description",
  "durationMinutes",
  "id",
  "ratingCount",
  "scheduledAt",
  "title",
].sort();

/** Slot/Proposal/Event-derived fields that must NEVER reach the hospital surface. */
const EVENT_DERIVED_FIELDS = [
  "eventCount",
  "nextActivity",
  "nextEventAt",
  "hasUpcomingEvents",
  "upcomingEventCount",
  "slots",
];

/** Hospital-identifying fields that must NEVER reach the event surface. */
const HOSPITAL_IDENTIFYING_FIELDS = [
  "hospitalId",
  "hospitalName",
  "hospitalProfileId",
  "city",
  "postalCode",
  "latitude",
  "longitude",
];

function aHospital(
  overrides: Partial<PublicHospitalProjection> = {},
): PublicHospitalProjection {
  return {
    name: "Hospital San Juan",
    city: "Bilbao",
    postalCode: "48013",
    latitude: 43.26,
    longitude: -2.94,
    ...overrides,
  };
}

function anEvent(
  overrides: Partial<PublicEventProjection> = {},
): PublicEventProjection {
  return {
    title: "Acoustic guitar afternoon",
    description: "A relaxed acoustic session for the pediatric ward.",
    scheduledAt: new Date("2026-08-01T17:00:00Z"),
    durationMinutes: 60,
    artistName: "Clara",
    audience: "all_ages",
    id: "event-1",
    averageStars: null,
    ratingCount: 0,
    ...overrides,
  };
}

describe("D10 non-correlation invariant — cross-surface, both directions", () => {
  it("PublicHospitalProjection carries no Slot/Proposal/Event-derived field", async () => {
    const deps = {
      publicHospitalDirectoryQuery: new FakePublicHospitalDirectoryQuery([aHospital()]),
    };

    const result = await listPublicHospitals(deps);

    for (const item of result) {
      expect(Object.keys(item).sort()).toEqual(HOSPITAL_ALLOW_LISTED_FIELDS);
      for (const field of EVENT_DERIVED_FIELDS) {
        expect(item).not.toHaveProperty(field);
      }
    }
  });

  it("PublicEventProjection carries no hospital-identifying field", async () => {
    const deps = {
      publicEventProjectionQuery: new FakePublicEventProjectionQuery([anEvent()]),
    };

    const result = await listPublishedEvents(deps);

    for (const item of result) {
      expect(Object.keys(item).sort()).toEqual(EVENT_ALLOW_LISTED_FIELDS);
      for (const field of HOSPITAL_IDENTIFYING_FIELDS) {
        expect(item).not.toHaveProperty(field);
      }
    }
  });

  it("HOSTILE ADAPTER: a port that attaches an eventCount/nextActivity field to a hospital is stripped", async () => {
    const hostileItem = {
      ...aHospital(),
      eventCount: 3,
      nextActivity: "Tuesday 17:00",
      hasUpcomingEvents: true,
      upcomingEventCount: 3,
    } as unknown as PublicHospitalProjection;
    const deps = {
      publicHospitalDirectoryQuery: new FakePublicHospitalDirectoryQuery([hostileItem]),
    };

    const result = await listPublicHospitals(deps);

    expect(result).toHaveLength(1);
    const [item] = result;
    expect(Object.keys(item).sort()).toEqual(HOSPITAL_ALLOW_LISTED_FIELDS);
    for (const field of EVENT_DERIVED_FIELDS) {
      expect(item).not.toHaveProperty(field);
    }
  });

  it("HOSTILE ADAPTER: a port that attaches hospital id/name/city/coordinates to an Event is stripped", async () => {
    const hostileItem = {
      ...anEvent(),
      hospitalId: "profile-secret-id",
      hospitalName: "Hospital San Juan",
      hospitalProfileId: "profile-secret-id",
      city: "Bilbao",
      postalCode: "48013",
      latitude: 43.26,
      longitude: -2.94,
    } as unknown as PublicEventProjection;
    const deps = {
      publicEventProjectionQuery: new FakePublicEventProjectionQuery([hostileItem]),
    };

    const result = await listPublishedEvents(deps);

    expect(result).toHaveLength(1);
    const [item] = result;
    expect(Object.keys(item).sort()).toEqual(EVENT_ALLOW_LISTED_FIELDS);
    for (const field of HOSPITAL_IDENTIFYING_FIELDS) {
      expect(item).not.toHaveProperty(field);
    }
  });

  it("events at different hospitals are not distinguishable by hospital — no field lets a visitor tell them apart by hospital", async () => {
    const deps = {
      publicEventProjectionQuery: new FakePublicEventProjectionQuery([
        anEvent({ title: "Event at Hospital A" }),
        anEvent({ title: "Event at Hospital B" }),
      ]),
    };

    const result = await listPublishedEvents(deps);

    for (const item of result) {
      expect(Object.keys(item).sort()).toEqual(EVENT_ALLOW_LISTED_FIELDS);
      for (const field of HOSPITAL_IDENTIFYING_FIELDS) {
        expect(item).not.toHaveProperty(field);
      }
    }
  });

  it("a hospital with published events looks identical in shape to one without (no event-derived field appears based on activity)", async () => {
    const busy = aHospital({ name: "Hospital With Events" });
    const quiet = aHospital({ name: "Hospital Without Events" });
    const deps = {
      publicHospitalDirectoryQuery: new FakePublicHospitalDirectoryQuery([busy, quiet]),
    };

    const result = await listPublicHospitals(deps);

    expect(result).toHaveLength(2);
    const [first, second] = result;
    expect(Object.keys(first).sort()).toEqual(Object.keys(second).sort());
    expect(Object.keys(first).sort()).toEqual(HOSPITAL_ALLOW_LISTED_FIELDS);
  });
});
