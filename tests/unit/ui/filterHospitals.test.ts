import { describe, expect, it } from "vitest";

import { filterHospitals } from "@ui/finder/filterHospitals";
import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";

function aHospital(
  overrides: Partial<PublicHospitalProjection> = {},
): PublicHospitalProjection {
  return {
    name: "Hospital San Juan",
    city: "Bilbao",
    postalCode: "48013",
    latitude: 43.263,
    longitude: -2.935,
    ...overrides,
  };
}

const CORUNA = aHospital({
  name: "Hospital de A Coruña",
  city: "A Coruña",
  postalCode: "15006",
  latitude: 43.3623,
  longitude: -8.4115,
});
const VALENCIA = aHospital({
  name: "Hospital Universitario del Mar",
  city: "Valencia",
  postalCode: "46011",
  latitude: 39.4699,
  longitude: -0.3763,
});
const NO_COORDS = aHospital({
  name: "Hospital Sin Coordenadas",
  city: "Sevilla",
  postalCode: "41003",
  latitude: null,
  longitude: null,
});

const DATASET: readonly PublicHospitalProjection[] = [
  aHospital(),
  CORUNA,
  VALENCIA,
  NO_COORDS,
];

describe("filterHospitals (D12 — client-side, pure, framework-free)", () => {
  it("returns everything, in the same order, for an empty query", () => {
    expect(filterHospitals(DATASET, "")).toEqual(DATASET);
  });

  it("returns everything for a whitespace-only query", () => {
    expect(filterHospitals(DATASET, "   ")).toEqual(DATASET);
  });

  it("matches by case-insensitive partial NAME substring", () => {
    const result = filterHospitals(DATASET, "san juan");

    expect(result).toEqual([DATASET[0]]);
  });

  it("matches by case-insensitive partial CITY substring", () => {
    const result = filterHospitals(DATASET, "bilb");

    expect(result).toEqual([DATASET[0]]);
  });

  it("matches POSTAL CODE by PREFIX only, not by arbitrary substring", () => {
    expect(filterHospitals(DATASET, "460")).toEqual([VALENCIA]);
    // "013" is a substring of "48013" but not a prefix — must NOT match.
    expect(filterHospitals(DATASET, "013")).toEqual([]);
  });

  it("is diacritic-insensitive: an unaccented query matches an accented stored value", () => {
    const result = filterHospitals(DATASET, "coruna");

    expect(result).toEqual([CORUNA]);
  });

  it("is diacritic-insensitive in reverse: an accented query matches an unaccented-equivalent stored value", () => {
    const target = aHospital({ name: "Hospital Malaga Centro", city: "Málaga", postalCode: "29001" });
    const result = filterHospitals([target], "málaga");

    expect(result).toEqual([target]);
  });

  it("never matches on a hospital's null city/postalCode fields", () => {
    // NO_COORDS has a real city/postalCode ("Sevilla"/"41003") — this proves
    // null LAT/LNG never crash the filter (coordinates are irrelevant to
    // search) and a query for its real city still finds it.
    expect(filterHospitals(DATASET, "sevilla")).toEqual([NO_COORDS]);

    // A hospital whose city is genuinely null must never match a city query.
    const noCity = aHospital({ name: "Hospital Anonimo", city: null, postalCode: null });
    expect(filterHospitals([noCity], "anyquery")).toEqual([]);
  });

  it("returns an empty array, never throws, for a query with no matches", () => {
    expect(filterHospitals(DATASET, "Zzzznotreal")).toEqual([]);
  });

  it("preserves the input's deterministic order among multiple matches", () => {
    const result = filterHospitals(DATASET, "hospital");

    expect(result).toEqual(DATASET);
  });

  it("caps the effective query length at 100 characters (longer input never crashes and matches nothing beyond that length)", () => {
    const longQuery = "a".repeat(500);

    expect(() => filterHospitals(DATASET, longQuery)).not.toThrow();
    expect(filterHospitals(DATASET, longQuery)).toEqual([]);
  });

  it("takes the first element when the query arrives as a searchParams-style array", () => {
    const result = filterHospitals(DATASET, ["bilbao", "ignored-second-value"]);

    expect(result).toEqual([DATASET[0]]);
  });
});
