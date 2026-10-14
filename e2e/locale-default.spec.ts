import { expect, test } from "@playwright/test";
import { baseURL } from "./support/baseUrl";

// The rest of the suite forces NEXT_LOCALE=en; this spec covers the real
// feature: Basque by default, Accept-Language ignored, the selector's choice
// persisting in the cookie. No cookie, and a Spanish browser.
test.use({ storageState: { cookies: [], origins: [] }, locale: "es-ES" });

test("first visit is Basque even with Accept-Language es-ES", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "eu");
});

test("choosing Castellano sets the cookie and persists after reload", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Castellano" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  const cookies = await context.cookies(baseURL);
  expect(cookies.find((c) => c.name === "NEXT_LOCALE")?.value).toBe("es");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("button", { name: "Castellano" })).toHaveAttribute("aria-current", "true");
});

test("an invalid NEXT_LOCALE value falls back to Basque", async ({ page, context }) => {
  await context.addCookies([{ name: "NEXT_LOCALE", value: "fr", url: baseURL }]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "eu");
});
