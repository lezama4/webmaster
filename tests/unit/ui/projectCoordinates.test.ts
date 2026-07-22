import { describe, expect, it } from "vitest";

import { projectCoordinates } from "@ui/finder/projectCoordinates";

// Bounding box per design D11: peninsular Spain + Balearics.
const MIN_LAT = 35.9;
const MAX_LAT = 43.9;
const MIN_LNG = -9.4;
const MAX_LNG = 4.4;

describe("projectCoordinates (D11 — a simple linear stretch, NOT a geographic projection)", () => {
  it("maps the south-west bbox corner to x=0%, y=100% (south is at the bottom)", () => {
    const result = projectCoordinates(MIN_LAT, MIN_LNG);

    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(100);
  });

  it("maps the north-east bbox corner to x=100%, y=0% (north is at the top)", () => {
    const result = projectCoordinates(MAX_LAT, MAX_LNG);

    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(0);
  });

  it("maps the north-west bbox corner to x=0%, y=0%", () => {
    const result = projectCoordinates(MAX_LAT, MIN_LNG);

    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it("maps the south-east bbox corner to x=100%, y=100%", () => {
    const result = projectCoordinates(MIN_LAT, MAX_LNG);

    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(100);
  });

  it("maps the bbox centre to x=50%, y=50%", () => {
    const result = projectCoordinates((MIN_LAT + MAX_LAT) / 2, (MIN_LNG + MAX_LNG) / 2);

    expect(result.x).toBeCloseTo(50);
    expect(result.y).toBeCloseTo(50);
  });

  it("y-inverts: a MORE NORTHERN point (higher latitude) yields a SMALLER y than a more southern one", () => {
    const south = projectCoordinates(37, -3.6);
    const north = projectCoordinates(43, -3.6);

    expect(north.y).toBeLessThan(south.y);
  });

  it("clamps latitude above the bbox (further north than MAX_LAT) to y=0, never negative", () => {
    const result = projectCoordinates(50, -3.6);

    expect(result.y).toBe(0);
  });

  it("clamps latitude below the bbox (further south than MIN_LAT) to y=100, never above 100", () => {
    const result = projectCoordinates(20, -3.6);

    expect(result.y).toBe(100);
  });

  it("clamps longitude beyond the west edge (e.g. the Canary Islands are NOT in this bbox) to x=0", () => {
    const result = projectCoordinates(28.1, -15.4);

    expect(result.x).toBe(0);
  });

  it("clamps longitude beyond the west edge to x=0", () => {
    const result = projectCoordinates(39, -20);

    expect(result.x).toBe(0);
  });

  it("real hospital coordinates (Bilbao) fall well inside [0,100] on both axes", () => {
    const result = projectCoordinates(43.263, -2.935);

    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.x).toBeLessThanOrEqual(100);
    expect(result.y).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeLessThanOrEqual(100);
  });
});
