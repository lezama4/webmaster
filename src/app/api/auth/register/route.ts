import { registerProfile } from "@application/use-cases/registerProfile";
import type { AccountRole } from "@domain/account/Account";
import { registrationDeps } from "@infrastructure/composition/container";
import { assertCsrfSafe } from "@infrastructure/http/csrfGuard";
import { toErrorResponse } from "@infrastructure/http/httpErrors";

interface RegisterRequestBody {
  readonly email?: unknown;
  readonly password?: unknown;
  readonly role?: unknown;
  readonly name?: unknown;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * `POST /api/auth/register` — Hospital/Artist self-registration (task 5.1).
 * CSRF-guard → parse → `registerProfile` → response; all error mapping via
 * `toErrorResponse`. Thin by design: every validation/authorization rule
 * lives in `registerProfile`/the domain layer, not here.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertCsrfSafe(request);

    const body = (await request.json()) as RegisterRequestBody;
    const profile = await registerProfile(
      {
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
        role: body.role as AccountRole,
        name: String(body.name ?? ""),
      },
      registrationDeps(),
    );

    // Generic success body — no Account/Profile id, no credential echo.
    return json(201, { status: profile.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
