import { validateProfile } from "@application/use-cases/validateProfile";
import { UnauthenticatedError } from "@application/errors";
import { adminDeps } from "@infrastructure/composition/container";
import { assertCsrfSafe } from "@infrastructure/http/csrfGuard";
import { toErrorResponse } from "@infrastructure/http/httpErrors";
import { getCurrentActor } from "@infrastructure/http/sessionCookie";

interface ValidateProfileRequestBody {
  readonly basis?: unknown;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * `POST /api/admin/profiles/[id]/approve` — Admin-only Profile approval
 * (task 5.3). Also covers the `rejected -> pending` re-registration queue
 * (M2, task 5.12) — the SAME endpoint, no separate path. CSRF-guard →
 * resolve `Actor` → parse `basis` → `validateProfile` → response.
 * Admin-only enforcement lives in `validateProfile`.
 *
 * `basis` (auditable-profile-approval, D24/D27): coerced with `String(...)`
 * per the codebase's existing thin-route convention (see
 * `registerProfile`'s route). This handler does NOT itself reject a blank
 * basis — the domain transition is the AUTHORITATIVE validator (D24), so a
 * blank/whitespace-only basis reaches `validateProfile`, throws a
 * `DomainValidationError`, and `toErrorResponse` maps it to 422. Coercing
 * `undefined`/non-string here to `""` keeps that single failure path, rather
 * than adding a second, route-level rejection that could drift from the
 * domain's rule.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    assertCsrfSafe(request);

    const actor = await getCurrentActor();
    if (!actor) {
      throw new UnauthenticatedError("No active session");
    }

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as ValidateProfileRequestBody;
    const profile = await validateProfile(
      actor,
      {
        profileId: id,
        decision: "approve",
        basis: typeof body.basis === "string" ? body.basis : "",
      },
      adminDeps(),
    );

    return json(200, { id: profile.id, status: profile.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
