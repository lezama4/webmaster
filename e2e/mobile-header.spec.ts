import { expect, test } from "@playwright/test";

const menuButton = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Menu", exact: true });

test.describe("mobile header (412px)", () => {
  test.use({ viewport: { width: 412, height: 915 } });

  test("menu opens, closes with Escape returning focus, and closes after navigating", async ({ page }) => {
    await page.goto("/");
    const button = menuButton(page);
    await expect(button).toHaveAttribute("aria-expanded", "false");
    const panel = page.locator(`#${await button.getAttribute("aria-controls")}`);
    await expect(panel).toBeHidden();

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
    for (const name of ["Find your centre", "Events", "Help", "About us", "Log in", "Register"]) {
      const item = panel.getByRole("link", { name });
      await expect(item).toBeVisible();
      expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(panel.getByRole("button", { name: "English" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
    await expect(panel).toBeHidden();

    await button.click();
    await panel.getByRole("link", { name: "Events" }).click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("exposes a single named navigation landmark", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(1);
  });
});

test("desktop (1280px) keeps the full nav and has no Menu button", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Events" })).toBeVisible();
  await expect(menuButton(page)).toHaveCount(0);
});

test.describe("Basque at 375px", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    storageState: { cookies: [], origins: [] },
  });

  test("closed and open menu do not overflow horizontally", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: "eu", url: baseURL! }]);
    await page.goto("/");
    const noOverflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(await noOverflow()).toBe(true);
    await page.getByRole("button", { name: "Menua", exact: true }).click();
    await expect(page.getByRole("link", { name: "Hasi saioa" })).toBeVisible();
    expect(await noOverflow()).toBe(true);
  });
});
