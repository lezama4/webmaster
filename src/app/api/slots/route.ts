import type { Audience } from "@domain/slot/Slot";
import { publishSlot } from "@application/use-cases/publishSlot";
import { UnauthenticatedError } from "@application/errors";
import { publishSlotDeps } from "@infrastructure/composition/container";
import { assertCsrfSafe } from "@infrastructure/http/csrfGuard";
import { toErrorResponse } from "@infrastructure/http/httpErrors";
import { getCurrentActor } from "@infrastructure/http/sessionCookie";

interface PublishSlotRequestBody {
  readonly title?: unknown;
  readonly description?: unknown;
  readonly scheduledAt?: unknown;
  readonly durationMinutes?: unknown;
  readonly location?: unknown;
  readonly audience?: unknown;
  readonly capacity?: unknown;
}

/**
 * The optional "aforo máximo" arrives as a string (or missing). An empty
 * string means "not set" → `null`; anything else is coerced to a number and
 * validated by the domain (`createSlot` throws on 0, negative, fractional or
 * out-of-range), so this handler never trusts the raw value beyond that gate.
 */
function parseCapacity(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }
  return Number(raw);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * `POST /api/slots` — Hospital-only Slot publication (task 5.4). CSRF-guard
 * → resolve the authenticated `Actor` → parse → `publishSlot` → response.
 * Role/live-status enforcement is entirely `publishSlot`'s responsibility
 * (defense-in-depth per ADR — this handler only supplies the resolved
 * `Actor`, never a client-claimed role).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertCsrfSafe(request);

    const actor = await getCurrentActor();
    if (!actor) {
      throw new UnauthenticatedError("No active session");
    }

    const body = (await request.json()) as PublishSlotRequestBody;
    const slot = await publishSlot(
      actor,
      {
        title: String(body.title ?? ""),
        description: String(body.description ?? ""),
        scheduledAt: new Date(String(body.scheduledAt ?? "")),
        durationMinutes: Number(body.durationMinutes ?? 0),
        location: String(body.location ?? ""),
        // `createSlot` (domain) validates this against the fixed Audience
        // union and throws DomainValidationError on an invalid value — this
        // handler never trusts the client-claimed value beyond that gate.
        audience: String(body.audience ?? "all_ages") as Audience,
        capacity: parseCapacity(body.capacity),
      },
      publishSlotDeps(),
    );

    return json(201, { id: slot.id, status: slot.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
