/**
 * Lat/lng -> percentage projection for the mocked hospital-finder map
 * (ADR D11). A pure, framework-free function so it is unit-testable without
 * a DOM and reusable by both `HospitalMap` and its Vitest suite.
 *
 * **This is a simple linear (equirectangular-style) stretch over a
 * hand-picked bounding box. It is NOT a real geographic projection** — it
 * applies no Mercator (or any other) correction, the aspect ratio is
 * distorted by whatever container renders it, and points outside the bbox
 * (e.g. the Canary Islands, Ceuta, Melilla) are clamped to the nearest edge,
 * which is visibly wrong for them. This is accepted deliberately: the map is
 * a mock whose job is "roughly where in Spain, and how spread out" — never
 * navigation. The corresponding visible UI copy ("indicative map, not to
 * scale") is what actually keeps this honest to the end user; do not remove
 * this doc comment or the caption in the same change.
 */

/** Bounding box: peninsular Spain + Balearics (D11). */
const MIN_LAT = 35.9;
const MAX_LAT = 43.9;
const MIN_LNG = -9.4;
const MAX_LNG = 4.4;

export interface ProjectedPoint {
  /** Horizontal position, percentage of the map container's width, clamped to [0, 100]. */
  readonly x: number;
  /** Vertical position, percentage of the map container's height, clamped to [0, 100]. North is up, so a higher latitude yields a SMALLER y. */
  readonly y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Projects a coordinate pair to a `{ x, y }` percentage point inside the
 * D11 bounding box, clamped to [0, 100] on both axes. Callers are
 * responsible for never calling this with a `null` latitude/longitude —
 * hospitals without coordinates are listed but produce no pin (spec:
 * "Hospital with null coordinates is listed but not pinned"); this function
 * has no "default to 0,0" fallback and must not grow one.
 */
export function projectCoordinates(latitude: number, longitude: number): ProjectedPoint {
  const xRatio = (longitude - MIN_LNG) / (MAX_LNG - MIN_LNG);
  const yRatio = (MAX_LAT - latitude) / (MAX_LAT - MIN_LAT);

  return {
    x: clamp(xRatio * 100, 0, 100),
    y: clamp(yRatio * 100, 0, 100),
  };
}
