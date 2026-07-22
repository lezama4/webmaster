import { expect, request, test } from "@playwright/test";

import {
  SEED_ACTIVE_HOSPITALS,
  SEED_COMPLETED_EVENT_TITLE,
  SEED_PUBLISHED_EVENT_TITLE,
} from "./support/helpers";

// Task 10.2 — ADR D10's non-correlation invariant, asserted at the BROWSER
// boundary, in both directions. This is the top layer of D10's defence
// table (design.md): the application-layer unit tests
// (`nonCorrelation.test.ts`) and the ESLint import zones close the routes a
// developer can reach from inside one file; THIS suite is what actually
// fails if a future contributor's change is observable to a real visitor —
// e.g. adding an "N upcoming events" badge to a hospital card, or a "which
// hospital?" hint to an event card. If you are here because this suite
// failed after adding a field, you are changing ADR D10 — read it before
// editing this file or the assertions below.

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const ALLOWED_HOSPITAL_KEYS = ["city", "latitude", "longitude", "name", "postalCode"];
// `id`, `averageStars` and `ratingCount` were admitted by Block 2 (event
// ratings). Each was checked against D10, not merely D6: `id` is the Event's
// own id and never the Slot's — the Slot is what belongs to a hospital — and
// the rating fields aggregate over the event, with individual ratings and
// rater identity excluded. None of them lets a visitor infer where an event
// happens. The same reasoning is recorded in tests/unit/application/
// nonCorrelation.test.ts, which owns the unit-level half of this invariant.
const ALLOWED_EVENT_KEYS = ["artistName", "audience", "averageStars", "description", "durationMinutes", "id", "ratingCount", "scheduledAt", "title"];

test.describe("/encuentra-tu-momento exposes NO event data (D10, hospital-to-event direction)", () => {
  test("GET /api/hospitals carries only the D9 allow-list keys and no seeded event title", async () => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get("/api/hospitals");
    const raw = await res.text();
    const body = JSON.parse(raw) as { hospitals: Array<Record<string, unknown>> };

    // Re-asserted here, not just in hospital-directory.spec.ts: an "N
    // upcoming events" badge would add a NAMED key, and the exact-key-set
    // check fails on ANY addition, whatever it is called (design.md's own
    // threat-model table).
    for (const hospital of body.hospitals) {
      expect(Object.keys(hospital).sort()).toEqual(ALLOWED_HOSPITAL_KEYS);
    }

    expect(raw, "must not leak the seeded published event's title").not.toContain(SEED_PUBLISHED_EVENT_TITLE);
    expect(raw, "must not leak the seeded completed event's title").not.toContain(SEED_COMPLETED_EVENT_TITLE);

    await ctx.dispose();
  });

  test("the rendered page never shows a seeded event title", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");

    await expect(page.getByText(SEED_PUBLISHED_EVENT_TITLE)).toHaveCount(0);
    await expect(page.getByText(SEED_COMPLETED_EVENT_TITLE)).toHaveCount(0);
  });
});

test.describe("/events exposes NO hospital data (D10, event-to-hospital direction)", () => {
  test("GET /api/events carries only the D6 allow-list keys and no seeded hospital name/city/postal code", async () => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get("/api/events");
    const raw = await res.text();
    const body = JSON.parse(raw) as { events: Array<Record<string, unknown>> };

    // Re-asserted here for the same reason as above: a "hosted at {city}"
    // hint on an event would add a NAMED key to PublicEventProjection.
    for (const event of body.events) {
      expect(Object.keys(event).sort()).toEqual(ALLOWED_EVENT_KEYS);
    }

    for (const hospital of SEED_ACTIVE_HOSPITALS) {
      expect(raw, `must not leak hospital name "${hospital.name}"`).not.toContain(hospital.name);
      expect(raw, `must not leak city "${hospital.city}"`).not.toContain(hospital.city);
      expect(raw, `must not leak postal code "${hospital.postalCode}"`).not.toContain(hospital.postalCode);
    }

    await ctx.dispose();
  });

  test("the rendered /events page never shows a seeded hospital name, city, or postal code", async ({ page }) => {
    await page.goto("/events");

    for (const hospital of SEED_ACTIVE_HOSPITALS) {
      await expect(page.getByText(hospital.name)).toHaveCount(0);
      await expect(page.getByText(hospital.city, { exact: false })).toHaveCount(0);
      await expect(page.getByText(hospital.postalCode)).toHaveCount(0);
    }
  });
});
