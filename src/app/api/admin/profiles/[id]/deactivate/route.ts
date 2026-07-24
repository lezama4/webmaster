import { deactivateProfile } from "@application/use-cases/deactivateProfile";
import { UnauthenticatedError } from "@application/errors";
import { adminDeps } from "@infrastructure/composition/container";
import { assertCsrfSafe } from "@infrastructure/http/csrfGuard";
import { toErrorResponse } from "@infrastructure/http/httpErrors";
import { getCurrentActor } from "@infrastructure/http/sessionCookie";

interface DeactivateProfileRequestBody {
  readonly basis?: unknown;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * `POST /api/admin/profiles/[id]/deactivate` — Admin-only Profile
 * deactivation (task 5.11, M3): `active -> deactivated`, cascading a full
 * session revocation for the owning Account, both atomically via
 * `deactivateProfile` (`ProfileUnitOfWork.withLockedProfile`). CSRF-guard →
 * resolve `Actor` → parse `basis` → `deactivateProfile` → response.
 *
 * `basis` (auditable-profile-approval, D24/D27): see `approve/route.ts` for
 * the full rationale — the domain transition is the AUTHORITATIVE validator,
 * this handler only coerces the shape.
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
    const body = (await request.json().catch(() => ({}))) as DeactivateProfileRequestBody;
    const profile = await deactivateProfile(
      actor,
      {
        profileId: id,
        basis: typeof body.basis === "string" ? body.basis : "",
      },
      adminDeps(),
    );

    return json(200, { id: profile.id, status: profile.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
