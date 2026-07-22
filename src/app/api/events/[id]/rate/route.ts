import { rateEvent } from "@application/use-cases/rateEvent";
import { UnauthenticatedError } from "@application/errors";
import { rateEventDeps } from "@infrastructure/composition/container";
import { assertCsrfSafe } from "@infrastructure/http/csrfGuard";
import { toErrorResponse } from "@infrastructure/http/httpErrors";
import { getCurrentActor } from "@infrastructure/http/sessionCookie";

interface RateEventRequestBody {
  readonly stars?: unknown;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * `POST /api/events/[id]/rate` — ANY registered (authenticated) Account may
 * rate a PUBLISHED Event 1-5 stars, one editable Rating per user per Event
 * (Phase 3, Block 2). CSRF-guard → resolve `Actor` → `rateEvent` → response.
 * No role gate here — unlike the Hospital/Artist/Admin-only routes, this is
 * open to every authenticated role (`rateEvent` itself never calls
 * `assertRole`). Only the resulting aggregate (average + count) and the
 * caller's OWN new stars value are returned — never another rater's data.
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
    const body = (await request.json()) as RateEventRequestBody;
    const result = await rateEvent(
      actor,
      { eventId: id, stars: Number(body.stars) },
      rateEventDeps(),
    );

    return json(200, {
      stars: result.rating.stars,
      averageStars: result.aggregate.averageStars,
      ratingCount: result.aggregate.ratingCount,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
