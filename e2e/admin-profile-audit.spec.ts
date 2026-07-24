import { expect, request, test, type BrowserContext, type Page } from "@playwright/test";
import es from "../messages/es.json";
import { SEED_USERS, loginAsNewSession, registerViaUi, uniqueSuffix } from "./support/helpers";

// Task 5.10 — auditable-profile-approval (D21-D27). Covers the
// `auditable-admin-decisions` and `public-hospital-directory`
// spec scenarios end-to-end, against a REAL running server:
//   1. A blank/whitespace-only basis is rejected by a DIRECT scripted POST
//      (bypassing the admin UI's own client-side gate entirely) — proving
//      the domain, not the form, is the authoritative check (D24, R2).
//   2. A valid basis approves the profile, AND the public `/api/hospitals`
//      JSON for that now-active centre still exposes NONE of the audit
//      fields (`reviewBasis`/an admin id/`reviewedAt`), in any form, in the
//      raw response body (D26).
//   3. (Task 5.11, e2e-checkable) The basis prompt is role-specific: a
//      `centre` row's placeholder cues institutional/convenio verification,
//      an `artist` row's cues identity + safeguarding — never the same text.
//
// Uses fresh, run-unique fixtures registered via the real UI (never the
// shared seeded "Hospital Esperanza") so this spec never mutates shared
// fixtures other specs depend on staying PENDING (authorization-edge-cases,
// hospital-directory, non-correlation all assert on Esperanza's PENDING
// status).

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const ALLOWED_HOSPITAL_KEYS = ["centreType", "city", "latitude", "longitude", "name", "postalCode"];
const FORBIDDEN_AUDIT_SUBSTRINGS = ["reviewBasis", "adminAccountId", "reviewedBy", "reviewedAt", "decision"];

/**
 * Extracts the raw Profile id from the basis textarea's `id` attribute
 * (`profile-basis-<id>`, `ProfileRowActions.tsx`) for the admin-queue row
 * matched by display name.
 */
async function profileIdForRow(adminPage: Page, displayName: string): Promise<string> {
  const row = adminPage.locator("li").filter({ hasText: displayName });
  await expect(row).toBeVisible();
  const textareaId = await row.locator("textarea").getAttribute("id");
  if (!textareaId) {
    throw new Error(`No basis textarea found for admin-queue row "${displayName}"`);
  }
  return textareaId.replace(/^profile-basis-/, "");
}

test.describe("Admin decision audit (auditable-profile-approval, D21-D27)", () => {
  test("a blank basis is rejected with no status change; a valid basis approves and leaks no audit field publicly", async ({
    browser,
    page,
  }) => {
    // This scenario chains a UI registration, a UI admin login, a DOM read,
    // two direct API calls, and a public API check across several routes
    // this Next.js dev server may not have compiled yet in this process —
    // each first hit pays a one-off dev-compile cost on top of the real
    // network round trips against the remote Neon dev host. The default 30s
    // budget is comfortably enough once routes are warm but is tight for a
    // cold run of this specific chain; extended explicitly rather than
    // silently retried.
    test.setTimeout(75_000);

    const runId = uniqueSuffix();
    const centre = {
      role: "centre" as const,
      name: `Audit Centre ${runId}`,
      email: `centre.audit.${runId}@vtt.test`,
      password: "AuditBasisPass123!",
    };

    const contexts: BrowserContext[] = [];
    try {
      await registerViaUi(page, centre);

      const admin = await loginAsNewSession(browser, SEED_USERS.admin);
      contexts.push(admin.context);
      // Deterministic locale for the DOM assertions below, independent of
      // the runner's own Accept-Language header (defaults to `es`, D13).
      await admin.context.addCookies([{ name: "NEXT_LOCALE", value: "es", url: baseURL }]);
      await admin.page.goto("/admin/profiles");

      const profileId = await profileIdForRow(admin.page, centre.name);

      const apiCtx = await request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });
      try {
        const loginRes = await apiCtx.post("/api/auth/login", { data: SEED_USERS.admin });
        expect(loginRes.status()).toBe(200);

        // Direct scripted POST, bypassing the UI's own gate entirely (R2) —
        // the domain must be the authoritative check (D24), not the form.
        const blankRes = await apiCtx.post(`/api/admin/profiles/${profileId}/approve`, {
          data: { basis: "   " },
        });
        expect(blankRes.status(), "a whitespace-only basis must be rejected (422)").toBe(422);

        // No partial state: the profile is still sitting in the pending queue.
        await admin.page.reload();
        await expect(admin.page.locator("li").filter({ hasText: centre.name })).toBeVisible();

        // A valid, non-blank basis approves.
        const validRes = await apiCtx.post(`/api/admin/profiles/${profileId}/approve`, {
          data: { basis: "Convenio VTT-2026-audit verified by phone with the named institutional contact." },
        });
        expect(validRes.status()).toBe(200);
      } finally {
        await apiCtx.dispose();
      }

      // The public directory now carries the newly-active centre, and still
      // exposes ONLY the D9 six-key allow-list — none of the D21 audit trail
      // (D26), in any form, anywhere in the raw response body.
      const publicCtx = await request.newContext({ baseURL });
      try {
        const hospitalsRes = await publicCtx.get("/api/hospitals");
        expect(hospitalsRes.status()).toBe(200);
        const raw = await hospitalsRes.text();
        const body = JSON.parse(raw) as { hospitals: Array<Record<string, unknown>> };

        const created = body.hospitals.find((h) => h.name === centre.name);
        expect(created, "the newly-approved centre must appear in the public directory").toBeTruthy();
        expect(Object.keys(created!).sort()).toEqual([...ALLOWED_HOSPITAL_KEYS].sort());

        for (const forbidden of FORBIDDEN_AUDIT_SUBSTRINGS) {
          expect(raw, `must not leak "${forbidden}" anywhere in the response`).not.toContain(forbidden);
        }
      } finally {
        await publicCtx.dispose();
      }
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });

  test("the basis prompt is role-specific: a centre's placeholder differs from an artist's (D27, e2e-checkable)", async ({
    browser,
    page,
  }) => {
    const runId = uniqueSuffix();
    const centre = {
      role: "centre" as const,
      name: `Prompt Centre ${runId}`,
      email: `centre.prompt.${runId}@vtt.test`,
      password: "AuditPromptPass123!",
    };
    const artist = {
      role: "artist" as const,
      name: `Prompt Artist ${runId}`,
      email: `artist.prompt.${runId}@vtt.test`,
      password: "AuditPromptPass123!",
    };

    await registerViaUi(page, centre);
    await registerViaUi(page, artist);

    const admin = await loginAsNewSession(browser, SEED_USERS.admin);
    try {
      await admin.context.addCookies([{ name: "NEXT_LOCALE", value: "es", url: baseURL }]);
      await admin.page.goto("/admin/profiles");

      const centrePlaceholder = await admin.page
        .locator("li")
        .filter({ hasText: centre.name })
        .locator("textarea")
        .getAttribute("placeholder");
      const artistPlaceholder = await admin.page
        .locator("li")
        .filter({ hasText: artist.name })
        .locator("textarea")
        .getAttribute("placeholder");

      // es.json is this repo's reference locale (D13) — asserting against
      // its actual shipped copy (not a hardcoded duplicate) keeps this test
      // honest if the wording changes.
      expect(centrePlaceholder).toBe(es.ProfileActions.basis.placeholder.centre);
      expect(artistPlaceholder).toBe(es.ProfileActions.basis.placeholder.artist);
      expect(centrePlaceholder).not.toBe(artistPlaceholder);
    } finally {
      await admin.context.close();
    }
  });
});
