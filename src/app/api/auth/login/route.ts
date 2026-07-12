import { createHash } from "node:crypto";
import { login } from "@application/use-cases/login";
import { loginDeps } from "@infrastructure/composition/container";
import { assertCsrfSafe } from "@infrastructure/http/csrfGuard";
import { toErrorResponse } from "@infrastructure/http/httpErrors";
import { setSessionCookie } from "@infrastructure/http/sessionCookie";

interface LoginRequestBody {
  readonly email?: unknown;
  readonly password?: unknown;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Derives `LoginContext.ipHash` (pr2a-M2) from `x-forwarded-for` — the
 * platform-set client-address header on this deployment target (Vercel,
 * per design.md's stack). Returns `undefined` when absent, per this task's
 * "omit if unavailable" instruction; `login`/`LoginRateLimiter` treat a
 * missing `ipHash` as "no per-client key for this attempt" (the per-account
 * key still applies). Hashed (never the raw address) and truncated, per
 * D7's "hashed/truncated IP" requirement.
 *
 * Flagged: `x-forwarded-for` is only as trustworthy as the deployment's
 * reverse proxy. On Vercel this header is platform-set; a self-hosted
 * deployment without a verified trusted-proxy config could have it spoofed
 * by the client, degrading only the IP-scoped half of the (belt-and-braces)
 * rate limit — never the CSRF check or authentication itself.
 */
function clientIpHash(request: Request): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim();
  if (!ip) return undefined;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * `POST /api/auth/login` — session issuance (task 5.2/5.13). CSRF-guarded
 * (M5 — login sets a cookie and is explicitly IN SCOPE, not excluded) →
 * parse → `login` → `setSessionCookie` → response. On success, the body
 * carries ONLY the role — never the bearer token (it lives exclusively in
 * the httpOnly cookie) and never any detail that would let a caller
 * distinguish "unknown email" from "wrong password" from "locked out" (M4
 * — `login` already raises the same generic `UnauthenticatedError` for all
 * three, mapped to a single generic 401 by `toErrorResponse`).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertCsrfSafe(request);

    const body = (await request.json()) as LoginRequestBody;
    const result = await login(
      { email: String(body.email ?? ""), password: String(body.password ?? "") },
      loginDeps(),
      { ipHash: clientIpHash(request) },
    );

    await setSessionCookie(result.session.id);

    return json(200, { role: result.account.role });
  } catch (error) {
    return toErrorResponse(error);
  }
}
