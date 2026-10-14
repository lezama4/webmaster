import { defineConfig } from "@playwright/test";

// M6: PLAYWRIGHT_BASE_URL (named by tasks.md 7.8) lets the same suite target
// a deployed environment. When it is set, no local dev server is started —
// a production/staging smoke run must not try to spawn `npm run dev`.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const isDeployedTarget = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Locally Playwright defaults to half the CPU threads (16 on a 32-thread
  // box). That many browsers hit `next dev` before its routes are compiled and
  // blow the 5s expect timeout in the register/login flows. CI runners are
  // small, so they keep the default.
  workers: process.env.CI ? undefined : 2,
  reporter: "html",
  use: {
    baseURL,
    locale: "en-US",
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
