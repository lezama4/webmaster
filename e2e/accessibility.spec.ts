import { expect, test, type Page } from "@playwright/test";
import { uniqueSuffix } from "./support/helpers";

// Keyboard and screen-reader contract of the public pages (WCAG 2.1 AA).
// Locale is forced to English by playwright.config.ts's storageState.

// Next's dev server adds an alert live region (route announcer) to every page,
// so alerts are always matched by their text, never bare.
const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });

test("the skip link is the first Tab stop, shows on focus and moves focus to main", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  const box = await skip.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page).toHaveURL(/#main-content$/);
});

test("the header navigation has an accessible name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
});

test("a failed login is announced and focus moves to the message", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill(`nobody-${uniqueSuffix()}@vtt.test`);
  await page.locator("#password").fill("wrong-password-123");
  await page.getByRole("button", { name: /log in/i }).click();
  const alert = alertWith(page, "Invalid email or password.");
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  // The message is about the credentials as a whole: no single field is flagged.
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
});

test("registering with a short password flags the password field only", async ({ page }) => {
  await page.goto("/register");
  await page.locator("#name").fill(`A11y Hospital ${uniqueSuffix()}`);
  await page.locator("#email").fill(`a11y-${uniqueSuffix()}@vtt.test`);
  await page.locator("#password").fill("short");
  await page.getByRole("button", { name: /create profile/i }).click();
  const alert = alertWith(page, "Use at least 8 characters.");
  await expect(alert).toBeVisible();
  const password = page.locator("#password");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAttribute("aria-describedby", "password-hint password-error");
  await expect(password).toBeFocused();
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(1);
  await expect(page.locator("#email")).not.toHaveAttribute("aria-invalid", /.*/);
});

// Walks the page with the Tab key only. A "focus trap" would never leave the
// page, so the walk must reach the end (body, or the dev-only Next portal) well
// within the cap; order must follow the DOM; every stop needs a drawn indicator.
for (const path of ["/", "/login", "/register", "/encuentra-tu-momento", "/events"]) {
  test(`keyboard walkthrough of ${path}: logical order, no trap, visible focus`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => {
      (window as unknown as { __prev: Element | null }).__prev = null;
    });
    const stops: { label: string; ordered: boolean; indicator: boolean }[] = [];
    let reachedEnd = false;
    for (let i = 0; i < 150; i++) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body || el.tagName === "NEXTJS-PORTAL") return null;
        const w = window as unknown as { __prev: Element | null };
        const ordered = !w.__prev || Boolean(w.__prev.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
        w.__prev = el;
        const s = getComputedStyle(el);
        const indicator = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
        return { label: `${el.tagName.toLowerCase()} ${(el.textContent || el.getAttribute("aria-label") || el.id).trim().slice(0, 40)}`, ordered, indicator };
      });
      if (!stop) {
        reachedEnd = true;
        break;
      }
      stops.push(stop);
    }
    expect(reachedEnd, "Tab left the page (no focus trap)").toBe(true);
    expect(stops[0]?.label).toContain("Skip to content");
    expect(stops.length).toBeGreaterThan(3);
    expect(stops.filter((s) => !s.ordered).map((s) => s.label), "focus follows DOM order").toEqual([]);
    expect(stops.filter((s) => !s.indicator).map((s) => s.label), "focus is visibly indicated").toEqual([]);
  });
}
