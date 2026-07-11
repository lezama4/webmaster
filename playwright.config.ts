import { defineConfig } from "@playwright/test";

// M6: PLAYWRIGHT_BASE_URL (named by tasks.md 7.8) lets the same suite target
// a deployed environment. When it is set, no local dev server is started —
// a production/staging smoke run must not try to spawn `npm run dev`.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const isDeployedTarget = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: isDeployedTarget
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
