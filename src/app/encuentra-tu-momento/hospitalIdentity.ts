import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";

/**
 * A stable DOM/selection key for a hospital card or pin. `id` is deliberately
 * excluded from `PublicHospitalProjection` (D9/D14), so this composes the
 * next-best identifying pair from the allow-listed fields. Not persisted,
 * not sent over the network — purely a React `key`/selection-state token
 * shared between `HospitalFinder` and `HospitalMap` so a pin activation can
 * be matched back to its list card.
 */
export function hospitalKey(hospital: Pick<PublicHospitalProjection, "name" | "postalCode">): string {
  return `${hospital.name}|${hospital.postalCode ?? ""}`;
}

/**
 * The pin/card accessible name (spec: `"{name}, {city} ({postalCode})"`, e.g.
 * "Hospital San Juan, Bilbao"). Built from hospital data, not translated UI
 * copy, so it composes directly rather than through an ICU template — city
 * and postal code are independently nullable (D9) and simply omitted when
 * absent.
 */
export function hospitalAccessibleName(
  hospital: Pick<PublicHospitalProjection, "name" | "city" | "postalCode">,
): string {
  const parts = [hospital.city, hospital.postalCode ? `(${hospital.postalCode})` : null].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? `${hospital.name}, ${parts.join(" ")}` : hospital.name;
}
