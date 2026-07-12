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
 * `POST /api/admin/profiles/[id]/approve` — Admin-only Profile approval
 * (task 5.3). Also covers the `rejected -> pending` re-registration queue
 * (M2, task 5.12) — the SAME endpoint, no separate path. CSRF-guard →
 * resolve `Actor` → `validateProfile` → response. Admin-only enforcement
 * lives in `validateProfile`.
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
      { profileId: id, decision: "approve" },
      adminDeps(),
    );

    return json(200, { id: profile.id, status: profile.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
