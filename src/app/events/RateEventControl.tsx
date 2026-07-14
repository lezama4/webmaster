"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

/**
 * Interactive 1-5 star control for a REGISTERED (authenticated) Account to
 * rate a PUBLISHED Event (Phase 3, Block 2). Pre-filled with the caller's
 * OWN existing rating (`initialStars`, from `listMyEventRatings` — never
 * another rater's). POSTs to `/api/events/[id]/rate`, which upserts on the
 * (event, rater) unique key — clicking again simply edits the same Rating.
 * `router.refresh()` on success re-fetches the server-rendered average from
 * `/events`'s `listPublishedEvents` call.
 */
export function RateEventControl({
  eventId,
  initialStars,
}: {
  eventId: string;
  initialStars: number | null;
}) {
  const t = useTranslations("Events");
  const router = useRouter();
  const [stars, setStars] = useState(initialStars ?? 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rate(value: number): Promise<void> {
    setError(null);
    setPending(true);
    const previous = stars;
    setStars(value);
    try {
      const res = await fetch(`/api/events/${eventId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars: value }),
      });
      if (!res.ok) {
        setStars(previous);
        setError(t("rating.error"));
        return;
      }
      router.refresh();
    } catch {
      setStars(previous);
      setError(t("rating.error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted">
        {stars > 0 ? t("rating.yourRating") : t("rating.title")}
      </p>
      <div className="flex items-center gap-0.5">
        {STAR_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            disabled={pending}
            aria-label={t("rating.starLabel", { value })}
            aria-pressed={value <= stars}
            onClick={() => rate(value)}
            className="p-0.5 text-accent transition-opacity disabled:opacity-60"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`size-5 ${value <= stars ? "fill-current" : "fill-none stroke-current stroke-[1.5] opacity-40"}`}
            >
              <path d="m10 1.6 2.48 5.03 5.55.81-4.02 3.92.95 5.53L10 14.28 5.04 16.9l.95-5.53-4.02-3.92 5.55-.81L10 1.6Z" />
            </svg>
          </button>
        ))}
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
