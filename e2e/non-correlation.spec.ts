import { expect, request, test } from "@playwright/test";

import {
  SEED_ACTIVE_HOSPITALS,
  SEED_COMPLETED_EVENT_TITLE,
  SEED_LOCATIONS,
  SEED_PUBLISHED_EVENT_TITLE,
} from "./support/helpers";

// Task 10.2 — ADR D10's non-correlation invariant, asserted at the BROWSER
// boundary, in both directions. This is the top layer of D10's defence
// table (design.md): the application-layer unit tests
// (`nonCorrelation.test.ts`) and the ESLint import zones close the routes a
// developer can reach from inside one file; THIS suite is what actually
// fails if a future contributor's change is observable to a real visitor —
// e.g. adding an "N upcoming events" badge to a hospital card.
//
// D10 REVISION (events-show-centre): the EVENT→HOSPITAL direction was
// deliberately relaxed — an event now names its hosting centre (public name +
// city) so families can find events at their relative's centre. What stays
// forbidden on events is the ward/room (`Slot.location`), postal code and
// street address. The HOSPITAL→EVENT direction below is UNCHANGED: the public
// directory still never reveals a centre's events. If you are here because a
// HOSPITAL-direction test failed after adding a field, you are changing D10 —
// read it first.

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
// widen-beyond-hospitals (D19): `centreType` joined the allow-list.
const ALLOWED_HOSPITAL_KEYS = ["centreType", "city", "latitude", "longitude", "name", "postalCode"];
// `id`, `averageStars` and `ratingCount` were admitted by Block 2 (event
// ratings). Each was checked against D10, not merely D6: `id` is the Event's
// own id and never the Slot's — the Slot is what belongs to a hospital — and
// the rating fields aggregate over the event, with individual ratings and
// rater identity excluded. None of them lets a visitor infer where an event
// happens. The same reasoning is recorded in tests/unit/application/
// nonCorrelation.test.ts, which owns the unit-level half of this invariant.
// D10 revision (events-show-centre): an event now names its HOSTING CENTRE —
// `centreName` (public institution) and `centreCity` (public directory field).
// A family cannot find events for their relative's centre without them. The
// privacy line moved to the INDIVIDUAL and the exact place: the ward/room
// (`Slot.location`), the postal code and the street address stay forbidden.
const ALLOWED_EVENT_KEYS = ["artistName", "audience", "averageStars", "capacity", "centreCity", "centreName", "description", "durationMinutes", "id", "ratingCount", "scheduledAt", "title"];

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

test.describe("/encuentra-tu-momento's Open Graph metadata and share affordance carry NO event data (D10, share-and-metadata)", () => {
  // Both directions reuse the page's own on-page `description` string as
  // BOTH the Open Graph description AND the share message (see
  // src/app/metadata.ts + each page's ShareRow call site) — these tests
  // assert that reused string never leaks through either surface, in
  // BROWSER-RENDERED output, not just the JSON source (already covered by
  // tests/unit/application/nonCorrelation.test.ts's static-copy checks).

  test("og:description and the meta description never name a seeded event title", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");

    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute("content");
    const metaDescription = await page.locator('meta[name="description"]').getAttribute("content");

    for (const title of [SEED_PUBLISHED_EVENT_TITLE, SEED_COMPLETED_EVENT_TITLE]) {
      expect(ogDescription, `og:description must not contain "${title}"`).not.toContain(title);
      expect(metaDescription, `meta description must not contain "${title}"`).not.toContain(title);
    }
  });

  test("the fallback share links (WhatsApp/Telegram/email) never carry a seeded event title", async ({ page }) => {
    // Deterministically force the non-native-share branch, regardless of
    // whether this browser/OS exposes `navigator.share` — the point is to
    // inspect the concrete href values ShareRow builds.
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "share", { value: undefined, configurable: true });
    });
    await page.goto("/encuentra-tu-momento");

    const hrefs = await Promise.all(
      [/whatsapp/i, /telegram/i, /email/i].map((name) => page.getByRole("main").getByRole("link", { name }).getAttribute("href")),
    );
    const decoded = hrefs.map((href) => decodeURIComponent(href ?? ""));

    for (const title of [SEED_PUBLISHED_EVENT_TITLE, SEED_COMPLETED_EVENT_TITLE]) {
      for (const href of decoded) {
        expect(href, `a share link must not contain "${title}"`).not.toContain(title);
      }
    }
  });

  test("the native-share payload (title/text/url) never carries a seeded event title", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "share", {
        configurable: true,
        value: (data: unknown) => {
          (window as typeof window & { __lastShare?: unknown }).__lastShare = data;
          return Promise.resolve();
        },
      });
    });
    await page.goto("/encuentra-tu-momento");

    await page.getByRole("main").getByRole("button", { name: /share/i }).click();
    const shared = await page.evaluate(
      () => (window as typeof window & { __lastShare?: Record<string, string> }).__lastShare,
    );
    const serialised = JSON.stringify(shared);

    for (const title of [SEED_PUBLISHED_EVENT_TITLE, SEED_COMPLETED_EVENT_TITLE]) {
      expect(serialised, `native share payload must not contain "${title}"`).not.toContain(title);
    }
  });
});

test.describe("/events names the hosting centre but never the ward/room, postal code or address (D10 revision)", () => {
  test("GET /api/events carries only the revised allow-list keys, names the centre, and never leaks the ward/room, postal code or address", async () => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get("/api/events");
    const raw = await res.text();
    const body = JSON.parse(raw) as { events: Array<Record<string, unknown>> };

    // The exact-key-set check still fails on ANY addition beyond the revised
    // allow-list — including a `centreType`, `location`, address or postal key.
    for (const event of body.events) {
      expect(Object.keys(event).sort()).toEqual(ALLOWED_EVENT_KEYS);
    }

    // The hosting centre's name IS now public (D10 revision) — a family needs
    // it to find events at their relative's centre. Every seeded event is
    // hosted by San Juan, so its name must appear.
    const sanJuan = SEED_ACTIVE_HOSPITALS.find((h) => h.name === "Hospital San Juan")!;
    expect(raw, "the hosting centre's public name is now exposed").toContain(sanJuan.name);

    // STILL forbidden: the postal code and street address (the projection
    // exposes name + city only), and the Slot ward/room `location`.
    for (const hospital of SEED_ACTIVE_HOSPITALS) {
      expect(raw, `must not leak postal code "${hospital.postalCode}"`).not.toContain(hospital.postalCode);
    }
    for (const location of SEED_LOCATIONS) {
      expect(raw, "must not leak a Slot ward/room location").not.toContain(location);
    }

    await ctx.dispose();
  });

  test("the rendered /events page shows the hosting centre but never its postal code or a ward/room location", async ({ page }) => {
    await page.goto("/events");

    // The hosting centre is now visible to a family browsing events.
    await expect(page.getByText("Hospital San Juan").first()).toBeVisible();

    for (const hospital of SEED_ACTIVE_HOSPITALS) {
      await expect(page.getByText(hospital.postalCode)).toHaveCount(0);
    }
    for (const location of SEED_LOCATIONS) {
      await expect(page.getByText(location)).toHaveCount(0);
    }
  });
});

test.describe("/events' Open Graph metadata and share affordance carry NO hospital data (D10, share-and-metadata)", () => {
  test("og:description and the meta description never name a seeded hospital, city, or postal code", async ({ page }) => {
    await page.goto("/events");

    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute("content");
    const metaDescription = await page.locator('meta[name="description"]').getAttribute("content");

    for (const hospital of SEED_ACTIVE_HOSPITALS) {
      for (const value of [hospital.name, hospital.city, hospital.postalCode]) {
        expect(ogDescription, `og:description must not contain "${value}"`).not.toContain(value);
        expect(metaDescription, `meta description must not contain "${value}"`).not.toContain(value);
      }
    }
  });

  test("the fallback share links (WhatsApp/Telegram/email) never carry a seeded hospital name, city, or postal code", async ({ page }) => {
    // Deterministically force the non-native-share branch, regardless of
    // whether this browser/OS exposes `navigator.share` — the point is to
    // inspect the concrete href values ShareRow builds.
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "share", { value: undefined, configurable: true });
    });
    await page.goto("/events");

    const hrefs = await Promise.all(
      [/whatsapp/i, /telegram/i, /email/i].map((name) => page.getByRole("main").getByRole("link", { name }).getAttribute("href")),
    );
    const decoded = hrefs.map((href) => decodeURIComponent(href ?? ""));

    for (const hospital of SEED_ACTIVE_HOSPITALS) {
      for (const value of [hospital.name, hospital.city, hospital.postalCode]) {
        for (const href of decoded) {
          expect(href, `a share link must not contain "${value}"`).not.toContain(value);
        }
      }
    }
  });

  test("the native-share payload (title/text/url) never carries a seeded hospital name, city, or postal code", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "share", {
        configurable: true,
        value: (data: unknown) => {
          (window as typeof window & { __lastShare?: unknown }).__lastShare = data;
          return Promise.resolve();
        },
      });
    });
    await page.goto("/events");

    await page.getByRole("main").getByRole("button", { name: /share/i }).click();
    const shared = await page.evaluate(
      () => (window as typeof window & { __lastShare?: Record<string, string> }).__lastShare,
    );
    const serialised = JSON.stringify(shared);

    for (const hospital of SEED_ACTIVE_HOSPITALS) {
      for (const value of [hospital.name, hospital.city, hospital.postalCode]) {
        expect(serialised, `native share payload must not contain "${value}"`).not.toContain(value);
      }
    }
  });
});
