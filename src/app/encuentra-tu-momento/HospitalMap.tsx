"use client";

import { useTranslations } from "next-intl";

import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";
import { projectCoordinates } from "@ui/finder/projectCoordinates";
import { selectMappableHospitals } from "@ui/finder/selectMappableHospitals";
import { BALEARIC_ISLANDS, SPAIN_MAINLAND_RING, toClosedSmoothPath } from "@ui/finder/spainOutline";

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

  // The landmass is projected through the SAME function as the pins, so the
  // coastline and the hospitals can never drift apart — see `spainOutline`.
  const mainland = toClosedSmoothPath(SPAIN_MAINLAND_RING.map(([lat, lng]) => projectCoordinates(lat, lng)));
  const islands = BALEARIC_ISLANDS.map(({ centre: [lat, lng], rx, ry }) => {
    const { x, y } = projectCoordinates(lat, lng);
    return { cx: x, cy: y, rx, ry };
  });

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
          <path d={mainland} />
          {islands.map((island) => (
            <ellipse key={`${island.cx}-${island.cy}`} cx={island.cx} cy={island.cy} rx={island.rx} ry={island.ry} />
          ))}
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
