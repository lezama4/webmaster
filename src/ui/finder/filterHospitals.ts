import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";
import type { CentreType } from "@domain/profile/Profile";

/** Query is capped so a runaway string can never make matching expensive or the input field unwieldy. */
const MAX_QUERY_LENGTH = 100;

/**
 * Normalises a value for matching (D12): trims, lower-cases with the
 * Spanish locale, then strips diacritics via Unicode `NFD` decomposition +
 * combining-mark removal — so `"malaga"` matches `"Málaga"` in either
 * direction. This is mandatory for Spanish; omitting it is a silent
 * correctness failure, not a cosmetic one.
 */
function normalise(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Resolves the raw query into a single, length-capped string. Handles the
 * `searchParams.q` edge case where a repeated query param arrives as a
 * `string[]` — takes the first element, never `String(array)` (which would
 * produce a comma-joined string and match nothing sensibly).
 */
function resolveQuery(query: string | readonly string[]): string {
  const raw = Array.isArray(query) ? (query[0] ?? "") : (query as string);
  return raw.slice(0, MAX_QUERY_LENGTH);
}

/**
 * Client-side hospital search (ADR D12) — a pure, framework-free function so
 * it is unit-testable without a DOM. Matches on `name`/`city` by
 * case-insensitive, diacritic-insensitive SUBSTRING, and on `postalCode` by
 * PREFIX only (`"48"` finds `"48013"`; `"013"` does not). `null` fields never
 * match. An empty/whitespace query returns everything, unmodified order
 * (D9's deterministic `city, name` sort is preserved because this function
 * never re-sorts). A query with no matches returns `[]`, never throws.
 *
 * No `RegExp` is ever constructed from the query — a user-supplied pattern
 * is a ReDoS vector. Only `String.prototype.includes`/`startsWith`.
 *
 * `centreType` (ADR D19/D12 extension) is a second, independent predicate,
 * combined with the text query by logical AND — a visitor narrowing to
 * "Residencia de mayores" AND typing a city gets only rows matching BOTH.
 * `"all"` (the default) is an explicit passthrough: every `centreType` is
 * included, identical to omitting the argument. This stays client-side
 * (ADR D12): the full active set already ships to the browser for the map,
 * so a `centreType` predicate exposes no new data.
 */
export function filterHospitals(
  hospitals: readonly PublicHospitalProjection[],
  query: string | readonly string[],
  centreType: CentreType | "all" = "all",
): readonly PublicHospitalProjection[] {
  const normalisedQuery = normalise(resolveQuery(query));

  return hospitals.filter((hospital) => {
    if (centreType !== "all" && hospital.centreType !== centreType) {
      return false;
    }

    if (normalisedQuery === "") {
      return true;
    }

    const nameMatch = hospital.name !== null && normalise(hospital.name).includes(normalisedQuery);
    const cityMatch = hospital.city !== null && normalise(hospital.city).includes(normalisedQuery);
    const postalCodeMatch =
      hospital.postalCode !== null && normalise(hospital.postalCode).startsWith(normalisedQuery);

    return nameMatch || cityMatch || postalCodeMatch;
  });
}
