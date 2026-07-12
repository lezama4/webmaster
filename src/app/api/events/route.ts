import { listPublishedEvents } from "@application/use-cases/listPublishedEvents";
import { publicDeps } from "@infrastructure/composition/container";
import { toErrorResponse } from "@infrastructure/http/httpErrors";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * `GET /api/events` — public, anonymous Events browsing (task 5.7). No auth,
 * no CSRF guard (GET is a safe method and this route never mutates state).
 * Returns exactly the `PublicEventProjection` allow-list the use case
 * produces (D6/M6) — no location, Proposal message, email, or internal id.
 */
export async function GET(): Promise<Response> {
  try {
    const events = await listPublishedEvents(publicDeps());
    return json(200, { events });
  } catch (error) {
    return toErrorResponse(error);
  }
}
