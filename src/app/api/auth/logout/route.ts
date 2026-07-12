import { logout } from "@application/use-cases/logout";
import { logoutDeps } from "@infrastructure/composition/container";
import { assertCsrfSafe } from "@infrastructure/http/csrfGuard";
import { toErrorResponse } from "@infrastructure/http/httpErrors";
import { clearSessionCookie, getSessionToken } from "@infrastructure/http/sessionCookie";

/**
 * `POST /api/auth/logout` — session revocation (task 5.2). CSRF-guard →
 * read the current session token → `logout` (revokes the row server-side,
 * D7 — logout is a DELETE, not just a cookie clear) → clear the cookie →
 * 204. No token present is not an error (already logged out) — the request
 * still clears the cookie and returns 204, idempotently.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertCsrfSafe(request);

    const token = await getSessionToken();
    if (token) {
      await logout(token, logoutDeps());
    }
    await clearSessionCookie();

    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
