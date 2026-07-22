import { expect, request, test } from "@playwright/test";

import {
  SEED_ACTIVE_HOSPITALS,
  SEED_HOSPITAL_LOCATIONS,
  SEED_NO_COORDINATES_HOSPITAL_NAME,
  SEED_PENDING_HOSPITAL_NAME,
} from "./support/helpers";

// Task 10.1 — the `/encuentra-tu-momento` journey (ADR D9 allow-list, D11
// mocked map + accessibility, D12 client-side search). Mirrors
// `public-projection.spec.ts`'s style: raw-JSON assertions for the privacy
// boundary, rendered-page assertions for the UX. The map is progressive
// enhancement over a real `<ul>` list (D11) — accessibility here is not
// aspirational, it is the design's central accessibility argument, so every
// scenario the design calls out gets a real, non-hollow assertion.
//
// IMPORTANT — this suite does NOT assume a closed-world hospital directory.
// `demo-chain.spec.ts` and `close-slot.spec.ts` register real Hospital
// profiles via the UI against this SAME shared, non-reset Neon `dev`
// database, and at least one of those fixtures (a hospital literally named
// "San Juan Hospital", with no coordinates) has been observed to reach
// ACTIVE status and persist indefinitely — there is no e2e-level teardown
// for it. Asserting a fixed total count (e.g. "exactly 4 hospitals") is
// therefore not reliable and is deliberately avoided below in favour of
// containment checks and search terms chosen to be collision-free against
// known fixture-naming patterns from other spec files.

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const ALLOWED_HOSPITAL_KEYS = ["city", "latitude", "longitude", "name", "postalCode"];

test.describe("GET /api/hospitals — allow-list boundary (D9/D14)", () => {
  test("returns exactly the allow-listed keys, every ACTIVE hospital, and never leaks addressLine/email/Esperanza", async () => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get("/api/hospitals");
    expect(res.status()).toBe(200);

    const raw = await res.text();
    const body = JSON.parse(raw) as { hospitals: Array<Record<string, unknown>> };

    expect(body.hospitals.length).toBeGreaterThanOrEqual(10);

    for (const hospital of body.hospitals) {
      expect(Object.keys(hospital).sort()).toEqual(ALLOWED_HOSPITAL_KEYS);
    }

    const names = body.hospitals.map((hospital) => hospital.name);
    const cities = new Set(body.hospitals.map((hospital) => hospital.city));
    for (const seeded of SEED_ACTIVE_HOSPITALS) {
      expect(names).toContain(seeded.name);
    }
    expect(cities.size).toBeGreaterThanOrEqual(10);
    expect(names).not.toContain(SEED_PENDING_HOSPITAL_NAME);

    for (const address of SEED_HOSPITAL_LOCATIONS) {
      expect(raw, "must not leak a hospital's addressLine").not.toContain(address);
    }
    expect(raw, "must not leak any email").not.toContain("@vtt.test");

    await ctx.dispose();
  });
});

test.describe("/encuentra-tu-momento — listing and search (D9/D12)", () => {
  test("renders every active hospital across multiple cities; Esperanza (PENDING) never appears", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");

    for (const hospital of SEED_ACTIVE_HOSPITALS) {
      await expect(page.getByRole("heading", { level: 2, name: hospital.name })).toBeVisible();
    }
    await expect(page.getByText(SEED_PENDING_HOSPITAL_NAME)).toHaveCount(0);
  });

  test("search filters by name, case-insensitively", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");
    // The FULL seeded name, uppercased. A bare "SAN JUAN" substring also
    // matches an unrelated UI-registered fixture from `demo-chain.spec.ts`
    // named (in reverse word order) "San Juan Hospital" — searching the
    // full, correctly-ordered name is both a genuine case-insensitivity
    // proof and collision-free against that fixture's different word order.
    await page.locator("#hospital-search").fill("HOSPITAL SAN JUAN");

    await expect(page.getByRole("heading", { level: 2, name: "Hospital San Juan" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Hospital Santa Clara" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Hospital San Rafael" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Hospital Universitario del Mar" })).toHaveCount(0);
  });

  test("search filters by city (partial match)", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");
    await page.locator("#hospital-search").fill("bilb");

    await expect(page.getByRole("heading", { level: 2, name: "Hospital San Juan" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Hospital Santa Clara" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Hospital San Rafael" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Hospital Universitario del Mar" })).toHaveCount(0);
  });

  test("search filters by postal code prefix, not by an interior substring", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");

    // "480" is a prefix of San Juan's "48013" -> matches.
    await page.locator("#hospital-search").fill("480");
    await expect(page.getByRole("heading", { level: 2, name: "Hospital San Juan" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Hospital Santa Clara" })).toHaveCount(0);

    // "013" is an interior substring of "48013", never a prefix -> no match
    // for San Juan specifically (spec: prefix-only). Assert absence rather
    // than a total-zero count, since an unrelated fixture with a colliding
    // postal code is not something this test controls.
    await page.locator("#hospital-search").fill("013");
    await expect(page.getByRole("heading", { level: 2, name: "Hospital San Juan" })).toHaveCount(0);
  });

  test("search is diacritic-insensitive (an accented query matches an unaccented stored city)", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");
    // None of the seeded city names carry a diacritic themselves, so this
    // demonstrates the direction that IS exercisable against the real seed:
    // a query typed WITH an accent still matches the stored, unaccented
    // "Zaragoza" (Hospital San Rafael) — proving NFD normalisation runs on
    // both sides, not just the stored value.
    await page.locator("#hospital-search").fill("zarágoza");

    await expect(page.getByRole("heading", { level: 2, name: "Hospital San Rafael" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Hospital San Juan" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Hospital Santa Clara" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Hospital Universitario del Mar" })).toHaveCount(0);
  });

  test("an empty query returns to the full active list", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");
    await page.locator("#hospital-search").fill("HOSPITAL SAN JUAN");
    await expect(page.getByRole("heading", { level: 2, name: "Hospital Santa Clara" })).toHaveCount(0);

    await page.locator("#hospital-search").fill("");
    // Every seeded ACTIVE hospital must be back — a fixed total count is
    // NOT asserted (see the file-level note on shared-database pollution).
    for (const hospital of SEED_ACTIVE_HOSPITALS) {
      await expect(page.getByRole("heading", { level: 2, name: hospital.name })).toBeVisible();
    }
  });

  test("a query with no matches shows the empty state, not an error", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");
    await page.locator("#hospital-search").fill("Zzzznotreal");

    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
    await expect(page.getByText("No hospitals match that search")).toBeVisible();
  });
});

test.describe("/encuentra-tu-momento — map/list accessibility (D11)", () => {
  test("pin count equals visible card count, before and after a search", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");
    const pins = page.getByTestId("hospital-pin");
    const cards = page.getByRole("heading", { level: 2 });
    const liveRegion = page.locator('#hospital-result-count');

    // Self-consistency check: whatever the live region CLAIMS is found/
    // mappable must equal what is actually in the DOM — robust to how many
    // hospitals a shared, non-reset environment happens to contain right
    // now (see the file-level note on cross-spec pollution), while still
    // proving the real D11 invariant (a hospital without coordinates gets
    // no pin, so pins <= cards, with the live region as the source of truth
    // for the expected split).
    const liveText = (await liveRegion.textContent()) ?? "";
    const match = liveText.match(/^(\d+) hospitals? found(?: · (\d+) shown on the map)?/);
    expect(match, `unexpected live-region text: "${liveText}"`).not.toBeNull();
    const expectedTotal = Number(match![1]);
    const expectedMappable = match![2] === undefined ? expectedTotal : Number(match![2]);

    expect(await cards.count()).toBe(expectedTotal);
    expect(await pins.count()).toBe(expectedMappable);

    // Scoped to a single, collision-free known hospital (see the "search
    // filters by name" test's note on why the full name is used): both
    // counts collapse to exactly one real, coordinate-having match.
    await page.locator("#hospital-search").fill("HOSPITAL SAN JUAN");
    await expect(cards).toHaveCount(1);
    await expect(pins).toHaveCount(1);
  });

  test("Tab reaches the first pin (a native button); Enter activates it, marking the pin pressed and its card current", async ({
    page,
  }) => {
    await page.goto("/encuentra-tu-momento");

    // Focus the search input directly (a natural, stable starting point
    // independent of how many links a future header redesign adds), then
    // Tab once: `<li>` cards carry no tabindex, so the very next focusable
    // element in DOM/tab order is the first map pin (D11: tab order == list
    // order, i.e. the D9 city-asc sort — "A Coruña"/"Hospital do Orzán"
    // sorts first among the 10-hospital roster; Bilbao/"Hospital San Juan"
    // was only first back when the seed had 4 ACTIVE hospitals).
    await page.locator("#hospital-search").focus();
    await page.keyboard.press("Tab");

    const firstPin = page.getByTestId("hospital-pin").first();
    await expect(firstPin).toBeFocused();

    await page.keyboard.press("Enter");

    await expect(firstPin).toHaveAttribute("aria-pressed", "true");
    const firstCard = page.locator("li").filter({ hasText: "Hospital do Orzán" });
    await expect(firstCard).toHaveAttribute("aria-current", "true");
  });

  test("each pin's accessible name contains its hospital's name", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");
    const pins = page.getByTestId("hospital-pin");
    const count = await pins.count();
    const labels: string[] = [];
    for (let i = 0; i < count; i += 1) {
      labels.push((await pins.nth(i).getAttribute("aria-label")) ?? "");
    }

    // Hospital del Guadiana has no coordinates and is deliberately excluded:
    // it renders no pin at all (see the "listed but renders no pin" test
    // below), so it has no aria-label to check here.
    for (const hospital of SEED_ACTIVE_HOSPITALS) {
      if (hospital.name === SEED_NO_COORDINATES_HOSPITAL_NAME) continue;
      expect(labels.some((label) => label.includes(hospital.name))).toBe(true);
    }
  });

  test("the aria-live region announces the filtered result count", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");
    const liveRegion = page.locator('#hospital-result-count');

    // Initial state: any non-empty result-count announcement (a fixed
    // number is not asserted — see the file-level note on shared-database
    // pollution). The meaningful, deterministic assertion is AFTER a
    // collision-free search narrows to exactly one known hospital.
    await expect(liveRegion).toHaveText(/^\d+ hospitals? found/i);

    await page.locator("#hospital-search").fill("HOSPITAL SAN JUAN");
    await expect(liveRegion).toHaveText(/^1 hospitals? found/i);
  });

  test("the 'indicative map, not to scale' caption is visible", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");
    await expect(page.getByText(/not to scale/i)).toBeVisible();
  });

  // Spec: "Hospital with null coordinates is listed but not pinned." The
  // 10-hospital roster expansion added Hospital del Guadiana (Extremadura)
  // with no latitude/longitude (modelling a hospital that registered before
  // setting its map position), closing the gap this test used to skip. The
  // invariant is also covered at the unit level:
  // `tests/unit/ui/selectMappableHospitals.test.ts` asserts a
  // null-coordinate hospital is excluded, composing the REAL
  // `projectCoordinates` (not a mock) — this test is the end-to-end proof.
  test("a hospital with null coordinates is listed but renders no pin", async ({ page }) => {
    await page.goto("/encuentra-tu-momento");

    const card = page.locator("li").filter({ hasText: SEED_NO_COORDINATES_HOSPITAL_NAME });
    await expect(card).toBeVisible();

    const pins = page.getByTestId("hospital-pin");
    const pinCount = await pins.count();
    for (let i = 0; i < pinCount; i += 1) {
      const label = (await pins.nth(i).getAttribute("aria-label")) ?? "";
      expect(label).not.toContain(SEED_NO_COORDINATES_HOSPITAL_NAME);
    }
  });
});

test.describe("/encuentra-tu-momento — locale rendering via NEXT_LOCALE cookie (D13/D15)", () => {
  const cases = [
    { locale: "es", title: "Encuentra tu hospital" },
    { locale: "eu", title: "Aurkitu zure ospitalea" },
    { locale: "en", title: "Find your hospital" },
  ] as const;

  for (const { locale, title } of cases) {
    test(`renders the page title in ${locale}`, async ({ page, context }) => {
      await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL }]);
      await page.goto("/encuentra-tu-momento");
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    });
  }
});
