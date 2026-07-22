import { expect, test } from "@playwright/test";

// Phase 11-12 (spec: public-information) — the home page's explanatory
// "clarity" block (`Home.what`) and the static `/quienes-somos` page.
// Written before the corresponding page edits exist (tasks 11.1/12.3),
// mirroring the e2e-first convention `hospital-directory.spec.ts` already
// established for Feature A: these are UI/presentation tasks, so the
// RED/GREEN cycle happens at the e2e level rather than a unit level.
//
// Default Playwright locale is `en-US` (see playwright.config.ts), which
// `src/i18n/request.ts` resolves to the `en` messages via Accept-Language
// when no `NEXT_LOCALE` cookie is set — so assertions below use the English
// copy without needing to set a cookie.

test.describe("Home clarity block (Home.what) — spec: 'Home Displays an Explanatory Block Before Mission'", () => {
  test("renders an h2 between the Hero h1 and the Mission h2, and links to /quienes-somos", async ({ page }) => {
    await page.goto("/");

    const heroHeading = page.getByRole("heading", { level: 1 });
    await expect(heroHeading).toBeVisible();
    const heroBox = await heroHeading.boundingBox();

    const clarityHeading = page.getByRole("heading", { level: 2, name: /live culture/i });
    await expect(clarityHeading).toBeVisible();
    const clarityBox = await clarityHeading.boundingBox();

    const missionHeading = page.getByRole("heading", { level: 2, name: /best moment of the month/i });
    await expect(missionHeading).toBeVisible();
    const missionBox = await missionHeading.boundingBox();

    expect(heroBox).not.toBeNull();
    expect(clarityBox).not.toBeNull();
    expect(missionBox).not.toBeNull();
    // Document order: Hero, then the clarity block, then Mission.
    expect(heroBox!.y).toBeLessThan(clarityBox!.y);
    expect(clarityBox!.y).toBeLessThan(missionBox!.y);

    const link = page.getByRole("link", { name: /how it works/i });
    await expect(link).toHaveAttribute("href", "/quienes-somos");
  });

  test("states the platform is free and non-profit, and the three-step flow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/vivetutiempo connects hospitals with artists/i)).toBeVisible();
    await expect(page.getByText(/hospitals publish open slots/i)).toBeVisible();
    await expect(page.getByText(/artists propose activities/i)).toBeVisible();
    await expect(page.getByText(/the event is published/i)).toBeVisible();
  });
});

test.describe("Home clarity block accessibility — spec: 'Accessibility of the Home Clarity Block'", () => {
  test("heading levels never skip on the home page", async ({ page }) => {
    await page.goto("/");

    const levels = await page.evaluate(() =>
      Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((el) =>
        Number(el.tagName.slice(1)),
      ),
    );

    expect(levels.length).toBeGreaterThan(1);
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      const increase = levels[i] - levels[i - 1];
      expect(increase, `heading jumped from h${levels[i - 1]} to h${levels[i]} at index ${i}`).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("/quienes-somos — spec: 'Covers Purpose, Roles, Flow, Validation, Data Stance, and Funding'", () => {
  test("anonymous visitor reaches the page and all six content areas are present", async ({ page }) => {
    await page.goto("/quienes-somos");
    await expect(page).toHaveURL(/\/quienes-somos$/);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Our purpose" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who takes part" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The journey, at a glance" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Validated profiles" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What data we publish, and what we don't" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Why it's free" })).toBeVisible();
  });

  test("data stance explicitly lists what is deliberately excluded from public data", async ({ page }) => {
    await page.goto("/quienes-somos");
    await expect(page.getByText(/exact room or ward/i)).toBeVisible();
    await expect(page.getByText(/content of proposals/i)).toBeVisible();
    await expect(page.getByText(/deliberately kept unlinked/i)).toBeVisible();
  });
});
