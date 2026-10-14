import { defineConfig } from "@playwright/test";
import { baseURL, isDeployedTarget } from "./e2e/support/baseUrl";

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
        command: `npm run dev -- --port ${new URL(baseURL).port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
