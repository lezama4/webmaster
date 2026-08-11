import { expect, test } from "@playwright/test";

import { SEED_USERS, loginAsNewSession } from "./support/helpers";

/**
 * The header's signed-in state. Until this shipped, a signed-in visitor saw
 * "Log in" and "Register" in the header — as if they were anonymous — and the
 * interface offered NO way to sign out at all: `POST /api/auth/logout` existed
 * and revoked the session row (ADR D7), but nothing ever called it.
 *
 * Everything asserted here is the visitor's OWN identity shown back to them,
 * so none of it touches the public projections' allow-lists.
 */
test.describe("site header reflects who is signed in", () => {
  test("a signed-in centre sees its own name and centre kind, and can sign out", async ({
    browser,
  }) => {
    const { context, page } = await loginAsNewSession(browser, SEED_USERS.hospitalSanJuan);
    const header = page.getByRole("banner");

    // Identified by its OWN kind ("Hospital"), not by the generic role.
    await expect(header.getByText("Hospital San Juan")).toBeVisible();
    await expect(header.getByText("Hospital", { exact: true })).toBeVisible();

    // The anonymous entries are gone precisely because they were the bug.
    await expect(header.getByRole("link", { name: /^log in$/i })).toHaveCount(0);
    await expect(header.getByRole("link", { name: /^register$/i })).toHaveCount(0);

    // Signing out returns the header to its anonymous state.
    await header.getByRole("button", { name: /log out/i }).click();
    await expect(header.getByRole("link", { name: /^log in$/i })).toBeVisible();
    await expect(header.getByText("Hospital San Juan")).toHaveCount(0);

    await context.close();
  });

  test("a signed-in artist is identified as an artist", async ({ browser }) => {
    const { context, page } = await loginAsNewSession(browser, SEED_USERS.artistClara);
    const header = page.getByRole("banner");

    await expect(header.getByText("Clara Romero")).toBeVisible();
    await expect(header.getByText("Artist", { exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: /log out/i })).toBeVisible();

    await context.close();
  });

  test("an anonymous visitor still sees log in and register", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");

    await expect(header.getByRole("link", { name: /^log in$/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /^register$/i })).toBeVisible();
    await expect(header.getByRole("button", { name: /log out/i })).toHaveCount(0);
  });
});
