import { expect, test } from "@playwright/test";

// Smoke test proving the Playwright runner is wired up correctly
// (Phase 1 scaffolding). The full demo-chain E2E lands in Phase 5
// (task 5.9, e2e/demo-chain.spec.ts).
test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vivetutiempo" })).toBeVisible();
});
