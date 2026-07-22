import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";

/** A `PublicHospitalProjection` narrowed to hospitals with real coordinates. */
export interface MappableHospital extends PublicHospitalProjection {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Filters to hospitals with BOTH a non-null `latitude` and `longitude` — the
 * only ones safe to pass into `projectCoordinates`, which has no null-guard
 * of its own (see its doc comment) and must never receive one. Per spec
 * ("Hospital with null coordinates is listed but not pinned"), a hospital
 * missing either coordinate is still rendered in the primary list (D9) but
 * MUST produce no map pin — it must never be silently defaulted to `0,0`.
 *
 * `HospitalMap` MUST route every hospital through this function before
 * calling `projectCoordinates`. Preserves source order (the D9 deterministic
 * `city, name` sort); never throws.
 */
export function selectMappableHospitals(
  hospitals: readonly PublicHospitalProjection[],
): readonly MappableHospital[] {
  return hospitals.filter(
    (hospital): hospital is MappableHospital => hospital.latitude !== null && hospital.longitude !== null,
  );
}
