import { cookies } from "next/headers";
import type { Actor } from "@application/Actor";
import {
  accountRepository,
  profileRepository,
  sessionPort,
} from "@infrastructure/composition/container";

/** httpOnly session cookie name (Phase 5 foundation). Carries ONLY the opaque bearer token — the DB row stores only its hash (ADR D8). */
export const SESSION_COOKIE = "vtt_session";

/**
 * Sets the session cookie. Flags per ADR D1/D7: `httpOnly` (never readable
 * from client JS), `secure` in production only (local HTTP dev still
 * works), `sameSite: "lax"` (D7 notes this alone is insufficient against
 * CSRF — the canonical-origin check in `csrfGuard.ts` is the actual
 * defense), `path: "/"` (valid for the whole app).
 */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

/** Clears the session cookie client-side. Does NOT revoke the server-side row — callers that need revocation call `SessionPort.revokeOne`/`revokeAllForAccount` (or the `logout` use case) separately. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Reads the raw session token from the cookie, or `null` if absent. Used by the logout route, which needs the bearer token itself (not a resolved `Actor`) to revoke the session row. */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Resolves the current request's `Actor` from the session cookie, or
 * `null` when unauthenticated.
 *
 * - No cookie → `null`.
 * - `resolveValid` returns `null` (not found, absolute-expired, or
 *   idle-expired) → the cookie is cleared and `null` is returned.
 * - `touch` returns `false` (session.ts, pr2b-M1: a zero-row update — not
 *   found, or expired by either clock, checked again at write time) → the
 *   cookie is cleared and `null` is returned, identically to an invalid
 *   `resolveValid`. The stale row itself is already deleted by `touch`/
 *   `resolveValid` in `session.ts`; this function only ever clears the
 *   COOKIE side.
 * - Valid + touched → the owning Account (and Profile, when one exists —
 *   D2: Admin/Patient accounts have none) are loaded and assembled into the
 *   `Actor` shape `Actor.ts` defines. `profileStatus` is a session-time
 *   snapshot ONLY — callers (use cases) MUST still re-check live status
 *   (M6); this function does not enforce that, it only reports it.
 */
export async function getCurrentActor(): Promise<Actor | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const sessions = sessionPort();
  const session = await sessions.resolveValid(token);
  if (!session) {
    await clearSessionCookie();
    return null;
  }

  const touched = await sessions.touch(token);
  if (!touched) {
    await clearSessionCookie();
    return null;
  }

  const account = await accountRepository().findById(session.accountId);
  if (!account) {
    await clearSessionCookie();
    return null;
  }

  const profile = await profileRepository().findByAccountId(account.id);

  return {
    accountId: account.id,
    role: account.role,
    profileId: profile?.id,
    profileStatus: profile?.status,
  };
}

/**
 * Read-only actor resolution for Server Component RENDER contexts, where
 * mutating the cookie store is forbidden (Next.js only permits cookie writes
 * in Server Actions / Route Handlers). Resolves the session WITHOUT clearing
 * the cookie and WITHOUT `touch` (no writes to the cookie side): reads the
 * cookie, validates via `resolveValid`, and returns the `Actor` or `null`.
 *
 * An invalid/expired cookie simply yields `null` here (the page can redirect
 * to /login); the stale cookie is cleared by the next MUTATING request, which
 * goes through `getCurrentActor`. A page view DOES extend the idle window (via
 * the `touch` below) — the 30-min idle timeout is measured from ANY activity,
 * not only mutations, so an actively-browsing user (reloading/navigating) is
 * not logged out; only a session with no requests at all for 30 min expires.
 * `touch` writes `lastActiveAt` in the DB, never a cookie, so it stays a valid
 * render-context read. `profileStatus` is a snapshot for display/gating hints
 * only; every mutation still re-checks live status inside its transaction (M6).
 */
export async function getCurrentActorReadOnly(): Promise<Actor | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const sessions = sessionPort();
  const session = await sessions.resolveValid(token);
  if (!session) return null;

  // Count a page view as activity: extend the idle window so an actively
  // browsing user (reloading/navigating) is not logged out at the 30-min idle
  // mark — only a genuinely idle session (no requests at all for 30 min) then
  // expires. `touch` writes `lastActiveAt` in the DB, NEVER a cookie, so it is
  // permitted in this render context. Best-effort: the actor is taken from the
  // already-validated `resolveValid`; a raced expiry is cleared next request.
  await sessions.touch(token);

  const account = await accountRepository().findById(session.accountId);
  if (!account) return null;

  const profile = await profileRepository().findByAccountId(account.id);

  return {
    accountId: account.id,
    role: account.role,
    profileId: profile?.id,
    profileStatus: profile?.status,
  };
}
