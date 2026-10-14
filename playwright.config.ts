import { defineConfig } from "@playwright/test";

// Playwright does not read .env. Load it so a git worktree's own APP_ORIGIN
// (each worktree gets its own port) is visible here; variables already set in
// the shell win. CI has no .env and sets its variables explicitly.
try {
  process.loadEnvFile();
} catch {
  // No .env file: nothing to load.
}

// The CSRF guard rejects any request whose Origin differs from APP_ORIGIN, so
// the dev server must run on APP_ORIGIN's port. Only a local origin is trusted
// here: a deployed origin in .env must never turn into a "local" run.
function localAppOrigin(): string | undefined {
  try {
    const url = new URL(process.env.APP_ORIGIN ?? "");
    return url.hostname === "localhost" && url.port ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

// M6: PLAYWRIGHT_BASE_URL (named by tasks.md 7.8) lets the same suite target
// a deployed environment. When it is set, no local dev server is started —
// a production/staging smoke run must not try to spawn `npm run dev`.
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? localAppOrigin() ?? "http://localhost:3000";
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
        command: `npm run dev -- --port ${new URL(baseURL).port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
