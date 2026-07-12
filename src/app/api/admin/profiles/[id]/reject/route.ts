import { validateProfile } from "@application/use-cases/validateProfile";
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
 * `POST /api/admin/profiles/[id]/reject` — Admin-only Profile rejection
 * (task 5.3). Revokes every live session for the Profile's Account
 * atomically with the transition (M3), enforced entirely by
 * `validateProfile`. CSRF-guard → resolve `Actor` → `validateProfile` →
 * response.
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
    const profile = await validateProfile(
      actor,
      { profileId: id, decision: "reject" },
      adminDeps(),
    );

    return json(200, { id: profile.id, status: profile.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
