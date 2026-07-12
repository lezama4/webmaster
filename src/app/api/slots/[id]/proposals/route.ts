import { submitProposal } from "@application/use-cases/submitProposal";
import { UnauthenticatedError } from "@application/errors";
import { matchingDeps } from "@infrastructure/composition/container";
import { assertCsrfSafe } from "@infrastructure/http/csrfGuard";
import { toErrorResponse } from "@infrastructure/http/httpErrors";
import { getCurrentActor } from "@infrastructure/http/sessionCookie";

interface SubmitProposalRequestBody {
  readonly message?: unknown;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * `POST /api/slots/[id]/proposals` — Artist-only Proposal submission (task
 * 5.5). CSRF-guard → resolve `Actor` → parse → `submitProposal` → response.
 * Role/live-status/open-Slot/duplicate-submission guards live entirely in
 * `submitProposal` (lock-first, D4/B2/M2).
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
    const body = (await request.json()) as SubmitProposalRequestBody;
    const proposal = await submitProposal(
      actor,
      { slotId: id, message: String(body.message ?? "") },
      matchingDeps(),
    );

    return json(201, { id: proposal.id, status: proposal.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
