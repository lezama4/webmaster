import { describe, expect, it } from "vitest";

import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";
import { projectCoordinates } from "@ui/finder/projectCoordinates";
import { selectMappableHospitals } from "@ui/finder/selectMappableHospitals";

/**
 * `projectCoordinates` has NO null-guard of its own (see its doc comment) —
 * it relies entirely on this filter to keep a null-coordinate hospital from
 * ever reaching it. Per spec ("Hospital with null coordinates is listed but
 * not pinned"), such a hospital MUST still appear in list/search results —
 * it simply produces no map pin, and must never be silently defaulted to
 * `0,0`. These tests fail if that guarantee is ever broken.
 */
function hospital(overrides: Partial<PublicHospitalProjection>): PublicHospitalProjection {
  return {
    name: "Hospital Test",
    city: "Bilbao",
    postalCode: "48013",
    latitude: 43.26,
    longitude: -2.94,
    ...overrides,
  };
}

describe("selectMappableHospitals", () => {
  it("keeps only hospitals with both latitude and longitude present", () => {
    const hospitals = [
      hospital({ name: "Valid" }),
      hospital({ name: "NullLat", latitude: null }),
      hospital({ name: "NullLng", longitude: null }),
      hospital({ name: "NullBoth", latitude: null, longitude: null }),
    ];

    expect(selectMappableHospitals(hospitals).map((h) => h.name)).toEqual(["Valid"]);
  });

  it("never lets a null-coordinate hospital reach projectCoordinates or produce a pin", () => {
    const hospitals = [
      hospital({ name: "Plottable", latitude: 40.4, longitude: -3.7 }),
      hospital({ name: "Unplottable", latitude: null, longitude: null }),
    ];

    const pins = selectMappableHospitals(hospitals).map((h) => ({
      name: h.name,
      // Composing the real projectCoordinates here is the point: if the
      // filter ever let a null through, this call would throw a type
      // error at compile time, or — for a runtime-only regression —
      // silently coerce null to 0 and produce a bogus 0,0-derived pin
      // that the assertions below would catch.
      ...projectCoordinates(h.latitude, h.longitude),
    }));

    expect(pins).toHaveLength(1);
    expect(pins[0]?.name).toBe("Plottable");
    expect(pins.some((pin) => pin.name === "Unplottable")).toBe(false);
    for (const pin of pins) {
      expect(Number.isNaN(pin.x)).toBe(false);
      expect(Number.isNaN(pin.y)).toBe(false);
    }
  });

  it("returns an empty array, never throws, when no hospital has coordinates", () => {
    expect(selectMappableHospitals([hospital({ latitude: null, longitude: null })])).toEqual([]);
  });

  it("preserves source order among mappable hospitals", () => {
    const hospitals = [
      hospital({ name: "B" }),
      hospital({ name: "NoCoords", latitude: null }),
      hospital({ name: "A" }),
    ];

    expect(selectMappableHospitals(hospitals).map((h) => h.name)).toEqual(["B", "A"]);
  });
});
