import { expect, test } from "@playwright/test";

// Smoke test proving the Playwright runner is wired up correctly and the
// landing page renders. Asserts the redesigned hero headline (the brand name
// "Vivetutiempo" now lives in the header nav as a link, not a heading).
test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /keep life/i }),
  ).toBeVisible();
});
