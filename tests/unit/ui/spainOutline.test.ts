import { describe, expect, it } from "vitest";

import {
  BALEARIC_ISLANDS,
  SPAIN_MAINLAND_RING,
  toClosedSmoothPath,
} from "@ui/finder/spainOutline";
import { projectCoordinates } from "@ui/finder/projectCoordinates";

/**
 * The outline exists to give the pins a geographic reference. Its ONE
 * load-bearing property is therefore not "does it look like Spain" — no test
 * can assert that — but "is it registered against the same projection the
 * pins use". These tests pin that down, so a future change to the bounding
 * box in `projectCoordinates` cannot silently leave the coastline behind
 * while the pins move.
 */

/** Ray casting. `ring` is a closed polygon of projected `{ x, y }` points. */
function isInside(point: { x: number; y: number }, ring: readonly { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    const straddles = a.y > point.y !== b.y > point.y;
    if (straddles && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

const projectedRing = SPAIN_MAINLAND_RING.map(([lat, lng]) => projectCoordinates(lat, lng));

describe("Spain outline geometry", () => {
  it("is expressed as real coordinates, not pre-computed viewBox numbers", () => {
    // Every vertex must be a plausible Iberian coordinate. If someone
    // replaces this ring with hand-tuned x/y values the registration
    // guarantee is gone, and this assertion is what notices.
    for (const [lat, lng] of SPAIN_MAINLAND_RING) {
      expect(lat).toBeGreaterThan(35);
      expect(lat).toBeLessThan(44.5);
      expect(lng).toBeGreaterThan(-10);
      expect(lng).toBeLessThan(5);
    }
  });

  it("projects entirely inside the drawable area without being clamped flat", () => {
    for (const point of projectedRing) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(100);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(100);
    }
    // A ring collapsed onto the bounding box edges would still satisfy the
    // range check above, so assert it actually spans the canvas.
    const xs = projectedRing.map((p) => p.x);
    const ys = projectedRing.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(80);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(80);
  });

  it("contains every seeded hospital coordinate", () => {
    // The seeded demo hospitals, by city. If a pin fell outside the
    // coastline the map would show a hospital in the sea, which is the
    // single most visible way this component can be wrong.
    const seeded: readonly [string, number, number][] = [
      ["A Coruña", 43.3623, -8.4115],
      ["Barcelona", 41.4011, 2.2135],
      ["Bilbao", 43.263, -2.935],
      ["Donostia", 43.3183, -1.9812],
      ["León", 42.5987, -5.5671],
      ["Madrid", 40.4268, -3.6883],
      ["Sevilla", 37.3891, -5.9845],
      ["Valencia", 39.4699, -0.3763],
      ["Zaragoza", 41.6488, -0.8891],
    ];

    for (const [city, lat, lng] of seeded) {
      const point = projectCoordinates(lat, lng);
      expect(isInside(point, projectedRing), `${city} falls outside the coastline`).toBe(true);
    }
  });

  it("places the Balearics east of the mainland and inside the canvas", () => {
    for (const [lat, lng] of BALEARIC_ISLANDS.map((island) => island.centre)) {
      const point = projectCoordinates(lat, lng);
      expect(point.x).toBeGreaterThan(70);
      expect(point.x).toBeLessThanOrEqual(100);
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(100);
    }
  });
});

describe("toClosedSmoothPath", () => {
  it("emits a closed cubic path anchored on the first point", () => {
    const path = toClosedSmoothPath(projectedRing);
    expect(path.startsWith("M")).toBe(true);
    expect(path.trimEnd().endsWith("Z")).toBe(true);
    expect(path).toContain("C");
    // One cubic segment per vertex, because the ring is closed.
    expect(path.match(/C/g)).toHaveLength(projectedRing.length);
  });

  it("emits no NaN", () => {
    expect(toClosedSmoothPath(projectedRing)).not.toContain("NaN");
  });

  it("returns an empty string for a degenerate ring", () => {
    expect(toClosedSmoothPath([])).toBe("");
    expect(toClosedSmoothPath([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBe("");
  });
});
