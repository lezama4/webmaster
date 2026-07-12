import { approveProposal } from "@application/use-cases/approveProposal";
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
 * `POST /api/slots/[id]/proposals/[pid]/approve` — owner-Hospital-only
 * Proposal approval (task 5.6, M1). CSRF-guard → resolve `Actor` →
 * `approveProposal` → response. Ownership/live-status/Proposal-Slot linkage
 * guards and the accept cascade (auto-reject rivals, fill Slot, publish
 * Event) live entirely in `approveProposal` (lock-first, D4/B2).
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
    const outcome = await approveProposal(
      actor,
      { slotId: id, proposalId: pid },
      matchingDeps(),
    );

    return json(200, {
      slot: { id: outcome.slot.id, status: outcome.slot.status },
      acceptedProposal: {
        id: outcome.acceptedProposal.id,
        status: outcome.acceptedProposal.status,
      },
      rejectedProposalIds: outcome.rejectedProposals.map((p) => p.id),
      eventId: outcome.event.id,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
