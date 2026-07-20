import { listPublicHospitals } from "@application/use-cases/listPublicHospitals";
import { hospitalDirectoryDeps } from "@infrastructure/composition/container";
import { toErrorResponse } from "@infrastructure/http/httpErrors";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * `GET /api/hospitals` — public, anonymous hospital-directory browsing
 * (Phase 7, ADR D9/D10). No auth, no CSRF guard (GET is a safe method and
 * this route never mutates state). Mirrors `src/app/api/events/route.ts`.
 *
 * The `/encuentra-tu-momento` page never calls this route itself — it
 * fetches via the use case directly (Server Component, D12). This route's
 * one job is to be the assertion boundary for the D9/D10/D14 privacy tests:
 * exact-key-set and forbidden-string assertions against a raw JSON payload
 * are far stronger and clearer than picking through rendered HTML or an RSC
 * flight payload (design, "Why an API route at all").
 *
 * Returns exactly the `PublicHospitalProjection` allow-list the use case
 * produces — no `addressLine`, email, internal id, or event-derived field
 * (D10: this route MUST NOT import anything from the Events surface — see
 * the `eslint.config.mjs` restricted-import zones).
 */
export async function GET(): Promise<Response> {
  try {
    const hospitals = await listPublicHospitals(hospitalDirectoryDeps());
    return json(200, { hospitals });
  } catch (error) {
    return toErrorResponse(error);
  }
}
