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
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import eu from "../../../messages/eu.json";
// Not imported from prisma/seed.ts for the same reason e2e/support/helpers.ts
// itself isn't: that file's top-level `main().then(...)` runs a real seeding
// side effect on import. e2e/support/helpers.ts is the existing, side-effect-
// free mirror of those constants (see its own file comment) and is already
// the single source `e2e/non-correlation.spec.ts` uses for this exact check
// at the browser boundary — reusing it here keeps both halves of the D10
// suite asserting against the SAME concrete names.
import {
  SEED_ACTIVE_HOSPITALS,
  SEED_COMPLETED_EVENT_TITLE,
  SEED_PENDING_HOSPITAL_NAME,
  SEED_PUBLISHED_EVENT_TITLE,
} from "../../../e2e/support/helpers";

/**
 * `centreType` (ADR D19, widen-beyond-hospitals) is admitted here by hand,
 * checked against D10 specifically, not merely D9/D14: it is a COARSE
 * public category (one of six known `CentreType` values) — not event-
 * derived, and it does not identify a specific centre any more precisely
 * than `name`/`city` already do. It carries no Slot/Proposal/Event
 * reference, so it cannot become a join key back to the event surface.
 * Admitted the same way Block 2's `id`/`averageStars`/`ratingCount` were
 * admitted onto `EVENT_ALLOW_LISTED_FIELDS` above — checked, named, and
 * typed out by a person, not derived from the DTO.
 */
const HOSPITAL_ALLOW_LISTED_FIELDS = [
  "centreType",
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

/**
 * Hospital/centre-identifying fields that must NEVER reach the event
 * surface. `centreType` (ADR D19) joins this list on the FORBIDDEN side for
 * events — it is a directory-side allow-listed field, never an event one;
 * admitting it on the directory does not loosen what an Event may carry.
 */
const HOSPITAL_IDENTIFYING_FIELDS = [
  "hospitalId",
  "hospitalName",
  "hospitalProfileId",
  "city",
  "postalCode",
  "latitude",
  "longitude",
  "centreType",
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
    centreType: "hospital",
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

  it("HOSTILE ADAPTER: a port that attaches hospital id/name/city/coordinates/centreType to an Event is stripped", async () => {
    const hostileItem = {
      ...anEvent(),
      hospitalId: "profile-secret-id",
      hospitalName: "Hospital San Juan",
      hospitalProfileId: "profile-secret-id",
      city: "Bilbao",
      postalCode: "48013",
      latitude: 43.26,
      longitude: -2.94,
      // ADR D19: centreType is a directory-side allow-listed field — an
      // adapter attaching it to an Event must still have it stripped.
      centreType: "palliative_unit",
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

/**
 * D10 extends past the DTOs above to the STATIC UI COPY layered on top of
 * them (share affordance + Open Graph metadata, task: share-and-metadata).
 * Share text and OG descriptions are hand-written strings in
 * `messages/*.json`, not derived from any query — nothing above stops a
 * future edit from writing "Concierto en el Hospital San Juan" as a
 * WhatsApp share message. `/events` and `/encuentra-tu-momento` both reuse
 * their own on-page `description` string as BOTH the Open Graph description
 * AND the share message (see `src/app/metadata.ts`'s `buildPageMetadata`
 * and the `ShareRow` call sites in each page) — deliberately, so there is
 * ONE string per page to audit here, not two independently-drifting ones.
 */
describe("D10 — static UI copy (share text & Open Graph description) must not correlate hospital <-> event", () => {
  const LOCALES = [
    { label: "es", messages: es },
    { label: "en", messages: en },
    { label: "eu", messages: eu },
  ] as const;

  it("Events.description (reused as OG description + share text) never names a seeded hospital, city, or postal code, in any locale", () => {
    const forbidden = [
      ...SEED_ACTIVE_HOSPITALS.flatMap((hospital) => [hospital.name, hospital.city, hospital.postalCode]),
      SEED_PENDING_HOSPITAL_NAME,
    ];

    for (const { label, messages } of LOCALES) {
      const description = messages.Events.description;
      for (const value of forbidden) {
        expect(description, `${label} Events.description must not contain "${value}"`).not.toContain(value);
      }
    }
  });

  it("Finder.description (reused as OG description + share text) never names a seeded event title, in any locale", () => {
    const forbidden = [SEED_PUBLISHED_EVENT_TITLE, SEED_COMPLETED_EVENT_TITLE];

    for (const { label, messages } of LOCALES) {
      const description = messages.Finder.description;
      for (const value of forbidden) {
        expect(description, `${label} Finder.description must not contain "${value}"`).not.toContain(value);
      }
    }
  });

  /**
   * Beyond named seed values: the product instruction for this surface is
   * categorical — Finder-surface copy must not mention events, scheduled
   * activities, or anything event-derived AT ALL, not just avoid one
   * specific seeded title. There is no DTO shape to allow-list against for
   * hand-authored copy, so a curated, per-locale term list is the concrete
   * way to assert that categorically (mirrors this file's own allow-list
   * philosophy, applied to prose instead of object keys).
   */
  const EVENT_INDICATING_TERMS: Record<(typeof LOCALES)[number]["label"], readonly string[]> = {
    es: ["evento", "eventos", "concierto", "actuaci", "actividad", "artista", "programad"],
    en: ["event", "concert", "performance", "activit", "artist", "scheduled"],
    eu: ["ekitaldi", "kontzertu", "jarduera", "artista", "programa"],
  };

  it("Finder.description contains no event-indicating term, in any locale", () => {
    for (const { label, messages } of LOCALES) {
      const description = messages.Finder.description.toLowerCase();
      for (const term of EVENT_INDICATING_TERMS[label]) {
        expect(
          description,
          `${label} Finder.description must not contain event-indicating term "${term}"`,
        ).not.toContain(term);
      }
    }
  });
});
