import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { SEED_PROPOSAL_IDS, SEED_SLOT_IDS, SEED_USERS } from "./support/helpers";

// Task 5.15 — the authorization/denial matrix, exercised through DIRECT API
// calls (Playwright's `request`, not the browser) so each assertion proves the
// denial happens in the APPLICATION LAYER (the use case's guards), not merely
// because the UI hid a button. Every request carries an `Origin` header equal
// to the app origin so the CSRF guard (task 5.13) passes and the request
// actually reaches the use case — except the one test that deliberately omits
// it to prove CSRF fails closed FIRST. All cases target the seeded dataset
// (every seeded Slot belongs to the active Hospital "San Juan"; "Esperanza" is
// a pending, non-active Hospital) and are denials, so none mutates state.

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const APPROVE_S1_CLARA = `/api/slots/${SEED_SLOT_IDS.s1OpenCompeting}/proposals/${SEED_PROPOSAL_IDS.s1Clara}/approve`;

function sameOriginContext(): Promise<APIRequestContext> {
  return request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } });
}

async function loginAs(credentials: { email: string; password: string }): Promise<APIRequestContext> {
  const ctx = await sameOriginContext();
  const res = await ctx.post("/api/auth/login", { data: credentials });
  expect(res.status(), `login for ${credentials.email} should succeed`).toBe(200);
  return ctx;
}

test("no session -> 401 on a mutating route", async () => {
  const ctx = await sameOriginContext(); // origin present, but never logged in
  const res = await ctx.post(APPROVE_S1_CLARA);
  expect(res.status()).toBe(401);
  await ctx.dispose();
});

test("missing Origin -> 403 (CSRF fails closed, before auth)", async () => {
  const ctx = await request.newContext({ baseURL }); // no Origin header
  const res = await ctx.post(APPROVE_S1_CLARA);
  expect(res.status()).toBe(403);
  await ctx.dispose();
});

test("artist on a hospital-only route -> 403", async () => {
  const ctx = await loginAs(SEED_USERS.artistClara);
  const res = await ctx.post("/api/slots", {
    data: {
      title: "Unauthorized publish attempt",
      description: "Should never be created.",
      scheduledAt: "2999-01-01T10:00",
      durationMinutes: 30,
      location: "nowhere",
    },
  });
  expect(res.status()).toBe(403);
  await ctx.dispose();
});

test("admin approving a proposal -> 403 (admin is not a hospital)", async () => {
  const ctx = await loginAs(SEED_USERS.admin);
  const res = await ctx.post(APPROVE_S1_CLARA);
  expect(res.status()).toBe(403);
  await ctx.dispose();
});

test("a pending (non-active) hospital cannot act -> 403", async () => {
  const ctx = await loginAs(SEED_USERS.hospitalEsperanza);
  const res = await ctx.post(APPROVE_S1_CLARA);
  expect(res.status()).toBe(403);
  await ctx.dispose();
});

test("owning hospital, proposal not on the target slot -> 404", async () => {
  const ctx = await loginAs(SEED_USERS.hospitalSanJuan);
  // s2Mateo belongs to S2, not S1 — the guard rejects the mismatch.
  const res = await ctx.post(
    `/api/slots/${SEED_SLOT_IDS.s1OpenCompeting}/proposals/${SEED_PROPOSAL_IDS.s2MateoAccepted}/approve`,
  );
  expect(res.status()).toBe(404);
  await ctx.dispose();
});

test("owning hospital, already-decided proposal on a filled slot -> 409", async () => {
  const ctx = await loginAs(SEED_USERS.hospitalSanJuan);
  const res = await ctx.post(
    `/api/slots/${SEED_SLOT_IDS.s2FilledPublished}/proposals/${SEED_PROPOSAL_IDS.s2MateoAccepted}/approve`,
  );
  expect(res.status()).toBe(409);
  await ctx.dispose();
});
