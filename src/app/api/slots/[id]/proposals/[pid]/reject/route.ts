import { rejectProposal } from "@application/use-cases/rejectProposal";
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
 * `POST /api/slots/[id]/proposals/[pid]/reject` — owner-Hospital-only manual
 * Proposal rejection (task 5.6, M1). CSRF-guard → resolve `Actor` →
 * `rejectProposal` → response. Ownership/live-status/Proposal-Slot linkage
 * guards live entirely in `rejectProposal` (lock-first, D4/B2/M1).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; pid: string }> },
): Promise<Response> {
  try {
    assertCsrfSafe(request);

    const actor = await getCurrentActor();
    if (!actor) {
      throw new UnauthenticatedError("No active session");
    }

    const { id, pid } = await params;
    const proposal = await rejectProposal(
      actor,
      { slotId: id, proposalId: pid },
      matchingDeps(),
    );

    return json(200, { id: proposal.id, status: proposal.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
