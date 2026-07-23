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
    // PR4 wiring handoff (auditable-profile-approval): this route sends no
    // body yet — parsing a real `basis` from the request (with a friendly
    // early rejection) is PR4's scope (D24 route wiring, D27 role-cued
    // copy). The domain remains the authoritative validator regardless, so
    // this placeholder cannot silently produce a persisted review: a blank
    // basis is rejected by `validateProfile`'s domain call before any
    // status change. This keeps the route compiling without doing PR4's UI
    // work.
    const profile = await validateProfile(
      actor,
      {
        profileId: id,
        decision: "approve",
        basis: "PR4-PENDING: route body-parsing lands with the basis textarea (D24/D27).",
      },
      adminDeps(),
    );

    return json(200, { id: profile.id, status: profile.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
