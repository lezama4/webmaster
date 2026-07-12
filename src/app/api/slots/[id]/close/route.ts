import { closeSlot } from "@application/use-cases/closeSlot";
import { UnauthenticatedError } from "@application/errors";
import { matchingDeps } from "@infrastructure/composition/container";
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
 * `POST /api/slots/[id]/close` — owner-Hospital-only Slot withdrawal (task
 * 5.10, B2). CSRF-guard → resolve `Actor` → `closeSlot` → response.
 * Ownership/role/live-status enforcement lives entirely in `closeSlot`.
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
    const outcome = await closeSlot(actor, { slotId: id }, matchingDeps());

    return json(200, {
      slot: { id: outcome.slot.id, status: outcome.slot.status },
      rejectedProposalIds: outcome.rejectedProposals.map((p) => p.id),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
