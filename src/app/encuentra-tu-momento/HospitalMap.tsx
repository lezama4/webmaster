"use client";

import { useTranslations } from "next-intl";

import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";
import { projectCoordinates } from "@ui/finder/projectCoordinates";
import { selectMappableHospitals } from "@ui/finder/selectMappableHospitals";

import { hospitalAccessibleName, hospitalKey } from "./hospitalIdentity";

/**
 * The mocked hospital-finder map (ADR D11): a decorative SVG frame plus real
 * HTML `<button>` pins, absolutely positioned by `projectCoordinates`. The
 * list in `HospitalFinder` is the primary, always-equivalent representation
 * — this component is progressive enhancement, and a screen-reader user
 * loses nothing by ignoring it entirely.
 *
 * Every hospital passed in is first routed through `selectMappableHospitals`
 * — a hospital with a null coordinate is listed elsewhere but renders no pin
 * here (spec: "Hospital with null coordinates is listed but not pinned").
 * DOM/tab order follows `hospitals`' incoming (D9-sorted) order, never a
 * geographic order.
 */
export function HospitalMap({
  hospitals,
  selectedKey,
  onSelect,
}: {
  hospitals: readonly PublicHospitalProjection[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const t = useTranslations("Finder");
  const pins = selectMappableHospitals(hospitals);

  return (
    <div
      role="group"
      aria-label={t("map.ariaLabel")}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-[20px] border border-border bg-surface-2"
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full text-border"
      >
        <rect x="2" y="2" width="96" height="96" rx="6" fill="none" stroke="currentColor" strokeWidth="1" />
        <line x1="2" y1="50" x2="98" y2="50" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
        <line x1="50" y1="2" x2="50" y2="98" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
      </svg>

      {pins.map((hospital) => {
        const key = hospitalKey(hospital);
        const point = projectCoordinates(hospital.latitude, hospital.longitude);
        const isSelected = selectedKey === key;

        return (
          <button
            key={key}
            type="button"
            data-testid="hospital-pin"
            aria-label={hospitalAccessibleName(hospital)}
            aria-pressed={isSelected}
            onClick={() => onSelect(key)}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-transform duration-150 motion-reduce:transition-none ${
              isSelected ? "z-10" : ""
            }`}
          >
            <span
              className={`h-3 w-3 rounded-full border-2 border-surface shadow transition-transform duration-150 motion-reduce:transition-none ${
                isSelected ? "scale-125 bg-primary" : "bg-accent"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
