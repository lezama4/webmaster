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
        className="absolute inset-0 h-full w-full text-muted"
      >
        <g
          fill="currentColor"
          fillOpacity="0.13"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="0.8"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        >
          {/* Mainland Spain, traced in the SAME normalised space as the pins:
              every vertex below is a real coastal or border coordinate run
              through the D11 bounding box (lat 35.9-43.9, lng -9.4-4.4), so
              the silhouette and the pins cannot drift apart. Coarse on
              purpose — this is the "roughly where in Spain" reference the
              pins were previously floating without, not a survey outline. */}
          <path d="M12.4 1.4 L27.1 4.4 L40.6 5.5 L46.2 6.9 L55.1 6.5 L63.0 15.0 L79.0 16.3 L92.2 19.8 L83.9 31.5 L74.4 40.0 L65.4 55.4 L69.8 64.6 L61.0 78.8 L52.3 89.8 L36.1 89.8 L27.5 98.8 L22.5 92.1 L14.4 83.6 L17.4 71.3 L15.9 55.0 L18.1 45.0 L18.8 36.3 L20.3 25.0 L3.8 25.4 L4.9 20.8 L0.9 12.8 L7.3 6.6 Z" />
          {/* Balearics — inside the same bounding box, so they belong here. */}
          <ellipse cx="89.9" cy="53.8" rx="3.4" ry="2.1" />
          <ellipse cx="97.8" cy="48.8" rx="1.6" ry="1.1" />
          <ellipse cx="78.5" cy="61.5" rx="1.8" ry="1.4" />
        </g>
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
