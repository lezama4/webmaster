import { expect, request, test } from "@playwright/test";
import {
  SEED_COMPLETED_EVENT_TITLE,
  SEED_HOSPITAL_LOCATIONS,
  SEED_LOCATIONS,
  SEED_PROPOSAL_IDS,
  SEED_PROPOSAL_MESSAGE_SAMPLE,
  SEED_PUBLISHED_EVENT_RATING_AGGREGATE,
  SEED_PUBLISHED_EVENT_TITLE,
  SEED_RATER_ACCOUNT_IDS,
  SEED_RATING_IDS,
  SEED_SLOT_IDS,
} from "./support/helpers";

// Tasks 6.2 + 6.4 — the public, anonymous Event projection (ADR D6). It must
// expose ONLY published Events and ONLY the five allow-listed fields; a
// `completed` Event, Slot locations, Proposal messages, emails, and internal
// ids must never appear. Asserted against the seeded dataset both at the JSON
// boundary (`GET /api/events`) and on the rendered public page (`/events`).
//
// D10 revision (events-show-centre): the projection now ALSO carries the
// hosting centre's PUBLIC name + city (from `Profile`), so a family can find
// events at their relative's centre. What must STILL never appear: the Slot's
// PRIVATE `location` (ward/room), and the centre's postal code / street
// address / coordinates. The assertions below prove the query exposes only
// name + city from the centre `Profile` — never its address-level fields — and
// never the Slot ward/room location.

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
// Phase 3/Block 2: the projection now also carries the Event's OWN `id`
// (needed to POST a rating) plus the read-only `averageStars`/`ratingCount`
// aggregate. Still no Slot/Proposal/Profile/Account id, Slot `location`,
// Proposal `message`, or any email — asserted below.
const ALLOWED_KEYS = [
  "artistName",
  "audience",
  "averageStars",
  // Optional "aforo máximo" (Slot.capacity), null when the centre sets none.
  "capacity",
  // D10 revision (events-show-centre): the hosting centre's PUBLIC name + city.
  // Still absent: Slot `location` (ward/room), the centre's postal/address, any
  // Profile/Slot/Proposal/Account id — all asserted below.
  "centreCity",
  "centreName",
  "description",
  "durationMinutes",
  "id",
  "ratingCount",
  "scheduledAt",
  "title",
];

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
  // Phase 3/Block 2: individual Rating rows and rater identity are NEVER
  // public — only the aggregate (averageStars/ratingCount) is. Confirms
  // adding ratings did not widen this projection beyond the aggregate.
  for (const id of SEED_RATING_IDS) {
    expect(raw, "must not leak a Rating id").not.toContain(id);
  }
  for (const id of SEED_RATER_ACCOUNT_IDS) {
    expect(raw, "must not leak a rater's Account id").not.toContain(id);
  }

  for (const event of body.events) {
    expect(Object.keys(event).sort()).toEqual(ALLOWED_KEYS);
  }

  // Positive-path check: S2's published Event DOES surface the public
  // aggregate (average + count) computed from its 3 seeded ratings.
  const publishedEvent = body.events.find(
    (event) => event.title === SEED_PUBLISHED_EVENT_TITLE,
  );
  expect(publishedEvent).toMatchObject(SEED_PUBLISHED_EVENT_RATING_AGGREGATE);

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
  // Phase 3/Block 2: the average + count aggregate IS shown (anonymous,
  // read-only) — but never a rater's identity or a Rating/Account id.
  await expect(page.getByText("4.7", { exact: false })).toBeVisible();
  for (const id of SEED_RATER_ACCOUNT_IDS) {
    await expect(page.getByText(id)).toHaveCount(0);
  }
});
