"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";
import { EmptyState, inputClasses } from "@ui/components/ui";
import { filterHospitals } from "@ui/finder/filterHospitals";
import { selectMappableHospitals } from "@ui/finder/selectMappableHospitals";

import { hospitalKey } from "./hospitalIdentity";
import { HospitalMap } from "./HospitalMap";

/** Matches `filterHospitals`' own cap — kept in sync so the input never accepts more than the filter will ever use. */
const MAX_QUERY_LENGTH = 100;
/** ADR D12: URL sync is debounced, not per-keystroke. */
const URL_SYNC_DEBOUNCE_MS = 300;

/**
 * Owns search state, filtering, and pin<->card selection for
 * `/encuentra-tu-momento` (ADR D12). The full ACTIVE hospital set is fetched
 * once by the Server Component parent; everything below is client-side.
 *
 * The list (`<ul>`) is the PRIMARY, always-rendered representation — the map
 * is progressive enhancement (D11). Search updates the URL via a debounced
 * `window.history.replaceState`, never `router.replace`, which would
 * re-render the whole server tree on every keystroke (D12).
 */
export function HospitalFinder({
  hospitals,
  initialQuery,
}: {
  hospitals: readonly PublicHospitalProjection[];
  initialQuery: string;
}) {
  const t = useTranslations("Finder");
  const [query, setQuery] = useState(initialQuery);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLLIElement>());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isFirstRender = useRef(true);

  const filtered = useMemo(() => filterHospitals(hospitals, query), [hospitals, query]);
  const mappableCount = useMemo(() => selectMappableHospitals(filtered).length, [filtered]);

  // ADR D12: reflect the query into the URL without a server round-trip or
  // a history entry per keystroke. Skips the very first render so an
  // unmodified `initialQuery` (already the current URL) doesn't trigger a
  // redundant replaceState.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (query.trim() === "") {
        params.delete("q");
      } else {
        params.set("q", query);
      }
      const search = params.toString();
      const next = search ? `${window.location.pathname}?${search}` : window.location.pathname;
      window.history.replaceState(null, "", next);
    }, URL_SYNC_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSelect(key: string) {
    setSelectedKey(key);
    const card = cardRefs.current.get(key);
    if (!card) return;
    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion ? "auto" : "smooth" });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <label htmlFor="hospital-search" className="text-sm font-medium">
          {t("search.label")}
        </label>
        <input
          id="hospital-search"
          type="search"
          value={query}
          maxLength={MAX_QUERY_LENGTH}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search.placeholder")}
          className={inputClasses}
        />
      </div>

      {/* ADR D11: client-side filtering mutates the DOM with no navigation
          to announce — without this, a screen-reader user gets silence
          while pins/cards appear or vanish. `id` lets e2e target THIS live
          region specifically — the page-level and footer ShareRow (task:
          share-and-metadata) each render their own `aria-live="polite"`
          copy-announcement region too, so the bare attribute selector is no
          longer unique on this page. */}
      <p id="hospital-result-count" aria-live="polite" aria-atomic="true" className="text-sm text-muted">
        {mappableCount < filtered.length
          ? t("resultCount.partial", { count: filtered.length, mappable: mappableCount })
          : t("resultCount.all", { count: filtered.length })}
      </p>

      {/* The map is a linear stretch over a fixed bounding box, not a real
          geographic projection — this caption is the honesty statement
          ADR D11 requires in visible UI copy, not only a doc comment. */}
      <p className="text-xs text-muted">{t("map.caption")}</p>

      {/* The list stays FIRST in the DOM so a screen-reader/keyboard user
          reaches the primary representation before the map's pin buttons
          (ADR D11). CSS `order` lifts the map ABOVE the list visually on
          mobile; on md+ the two sit side by side (list left, map right) and
          order is reset, so source order and visual order agree there. */}
      <div className="grid gap-8 md:grid-cols-[1.1fr_1fr]">
        {filtered.length === 0 ? (
          <div className="order-2 md:order-none">
            <EmptyState title={t("empty.title")} description={t("empty.description")} />
          </div>
        ) : (
          <ul className="order-2 flex flex-col gap-4 md:order-none">
            {filtered.map((hospital) => {
              const key = hospitalKey(hospital);
              return (
                <li
                  key={key}
                  ref={(el) => {
                    if (el) cardRefs.current.set(key, el);
                    else cardRefs.current.delete(key);
                  }}
                  aria-current={selectedKey === key ? "true" : undefined}
                  className={`flex flex-col gap-1 rounded-[20px] border p-5 shadow-sm transition-colors motion-reduce:transition-none ${
                    selectedKey === key ? "border-primary bg-surface" : "border-border bg-surface"
                  }`}
                >
                  <h2 className="text-lg font-semibold tracking-tight">{hospital.name}</h2>
                  <p className="text-sm text-muted">
                    {[hospital.city, hospital.postalCode].filter(Boolean).join(" · ") || t("noLocation")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <div className="order-1 md:order-none">
          <HospitalMap hospitals={filtered} selectedKey={selectedKey} onSelect={handleSelect} />
        </div>
      </div>
    </div>
  );
}
