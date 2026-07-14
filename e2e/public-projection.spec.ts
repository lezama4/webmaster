import { expect, request, test } from "@playwright/test";
import {
  SEED_COMPLETED_EVENT_TITLE,
  SEED_HOSPITAL_LOCATIONS,
  SEED_LOCATIONS,
  SEED_PROPOSAL_IDS,
  SEED_PROPOSAL_MESSAGE_SAMPLE,
  SEED_PUBLISHED_EVENT_TITLE,
  SEED_SLOT_IDS,
} from "./support/helpers";

// Tasks 6.2 + 6.4 — the public, anonymous Event projection (ADR D6). It must
// expose ONLY published Events and ONLY the five allow-listed fields; a
// `completed` Event, Slot locations, Proposal messages, emails, and internal
// ids must never appear. Asserted against the seeded dataset both at the JSON
// boundary (`GET /api/events`) and on the rendered public page (`/events`).
//
// Phase 2 addition: Hospitals now also carry a SEPARATE, PUBLIC location
// (city/postal code/address/coordinates on `Profile`) for a later map/filter
// feature. That is a DIFFERENT surface from Slot's PRIVATE `location` (ward/
// room) — ADR D6 is specifically about the latter never appearing here. The
// assertion below confirms introducing hospital public location did not
// widen this projection: `PublicEventProjectionQuery` still selects only
// Slot + accepted-Proposal-artist fields, never anything from `Profile`
// beyond the artist's display name — so even PUBLIC hospital address data
// must not leak through this endpoint.

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const ALLOWED_KEYS = ["artistName", "audience", "description", "durationMinutes", "scheduledAt", "title"];

test("GET /api/events returns only published events and never leaks forbidden data (6.4)", async () => {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.get("/api/events");
  expect(res.status()).toBe(200);

  const raw = await res.text();
  const body = JSON.parse(raw) as { events: Array<Record<string, unknown>> };
  const titles = body.events.map((event) => event.title);

  expect(titles).toContain(SEED_PUBLISHED_EVENT_TITLE); // S2 is published
  expect(titles).not.toContain(SEED_COMPLETED_EVENT_TITLE); // S5 is completed, not published

  for (const location of SEED_LOCATIONS) {
    expect(raw, "must not leak a Slot location").not.toContain(location);
  }
  for (const address of SEED_HOSPITAL_LOCATIONS) {
    // Phase 2: hospitals now have a PUBLIC address elsewhere on Profile —
    // this endpoint must still never join/leak it (the projection only ever
    // carries Slot + accepted-Proposal-artist fields, ADR D6).
    expect(raw, "must not leak a hospital's public address").not.toContain(address);
  }
  expect(raw, "must not leak a Proposal message").not.toContain(SEED_PROPOSAL_MESSAGE_SAMPLE);
  expect(raw, "must not leak any email").not.toContain("@vtt.test");
  for (const id of Object.values(SEED_SLOT_IDS)) {
    expect(raw, "must not leak a Slot id").not.toContain(id);
  }
  for (const id of Object.values(SEED_PROPOSAL_IDS)) {
    expect(raw, "must not leak a Proposal id").not.toContain(id);
  }

  for (const event of body.events) {
    expect(Object.keys(event).sort()).toEqual(ALLOWED_KEYS);
  }

  await ctx.dispose();
});

test("the public /events page shows the published event, not the completed one, and no location (6.2)", async ({
  page,
}) => {
  await page.goto("/events");
  await expect(page.getByText(SEED_PUBLISHED_EVENT_TITLE)).toBeVisible();
  await expect(page.getByText(SEED_COMPLETED_EVENT_TITLE)).toHaveCount(0);
  for (const location of SEED_LOCATIONS) {
    await expect(page.getByText(location)).toHaveCount(0);
  }
});
