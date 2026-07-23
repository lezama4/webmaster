import { expect, request, test } from "@playwright/test";

import {
  SEED_ACTIVE_CENTRE_TYPES,
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
// widen-beyond-hospitals (D19): `centreType` joined the allow-list.
const ALLOWED_HOSPITAL_KEYS = ["centreType", "city", "latitude", "longitude", "name", "postalCode"];
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

test.describe("/events — centreType adds no new correlation path (D10, widen-beyond-hospitals D19 extension)", () => {
  test("GET /api/events never carries a centreType/type key or value, including for the seed's lone rare-type city", async () => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get("/api/events");
    const raw = await res.text();
    const body = JSON.parse(raw) as { events: Array<Record<string, unknown>> };

    // Re-asserted per-key here for the same reason as the allow-list check
    // above: an addition of `centreType` or `type` would be a NAMED key,
    // whatever shape it took.
    for (const event of body.events) {
      expect(event).not.toHaveProperty("centreType");
      expect(event).not.toHaveProperty("type");
    }

    // León is the seed's ONLY city with an ACTIVE centre — "Unidad de
    // Cuidados Paliativos del Bernesga", a palliative_unit, and no other
    // centre. This is the seed's concrete instance of the "lone rare type"
    // case (public-event-browsing spec): if any Event field revealed this
    // centre's city, name, or centreType, a visitor could deduce that any
    // Event naming León was hosted at the region's sole palliative unit.
    expect(raw, "must not leak the lone rare-type centre's city").not.toContain("León");
    expect(raw, "must not leak the lone rare-type centre's name").not.toContain("Bernesga");

    // No `centreType` value of any kind appears anywhere in the Events
    // response — the widened six-value vocabulary has no new join key to
    // leak through, matching zero seeded Slot/Event title or description.
    for (const centreType of SEED_ACTIVE_CENTRE_TYPES) {
      expect(raw, `must not leak a centreType value ("${centreType}")`).not.toContain(centreType);
    }

    await ctx.dispose();
  });

  test("events from centres of two different centreType values remain indistinguishable by centre", async () => {
    // Hospital San Juan (centreType hospital) and Residencia Urumea
    // (centreType nursing_home) are two ACTIVE centres of different kinds.
    // Neither their names nor cities nor centreType values appear on the
    // Events surface — re-asserted specifically across a type BOUNDARY,
    // not just within one type, closing the "different kinds are
    // indistinguishable" half of the widened non-correlation invariant.
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get("/api/events");
    const raw = await res.text();

    const sanJuan = SEED_ACTIVE_HOSPITALS.find((h) => h.name === "Hospital San Juan")!;
    const urumea = SEED_ACTIVE_HOSPITALS.find((h) => h.name === "Residencia Urumea")!;
    expect(sanJuan.centreType).not.toBe(urumea.centreType);

    for (const centre of [sanJuan, urumea]) {
      expect(raw, `must not leak "${centre.name}"`).not.toContain(centre.name);
      expect(raw, `must not leak "${centre.city}"`).not.toContain(centre.city);
      expect(raw, `must not leak centreType "${centre.centreType}"`).not.toContain(centre.centreType);
    }

    await ctx.dispose();
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
