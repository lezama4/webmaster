import { deactivateProfile } from "@application/use-cases/deactivateProfile";
import { UnauthenticatedError } from "@application/errors";
import { adminDeps } from "@infrastructure/composition/container";
import { assertCsrfSafe } from "@infrastructure/http/csrfGuard";
import { toErrorResponse } from "@infrastructure/http/httpErrors";
import { getCurrentActor } from "@infrastructure/http/sessionCookie";

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
 * resolve `Actor` → `deactivateProfile` → response.
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
    // PR4 wiring handoff (auditable-profile-approval): see approve/route.ts
    // — real basis body-parsing lands with PR4 (D24 route wiring, D27
    // role-cued copy). The domain remains authoritative regardless.
    const profile = await deactivateProfile(
      actor,
      {
        profileId: id,
        basis: "PR4-PENDING: route body-parsing lands with the basis textarea (D24/D27).",
      },
      adminDeps(),
    );

    return json(200, { id: profile.id, status: profile.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
