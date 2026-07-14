/**
 * A row of 5 star icons showing a rating out of 5. Purely presentational —
 * filled stars use the `accent` design token (never a hardcoded hex) so it
 * adapts automatically between light and dark mode. The numeric label is
 * exposed as an accessible name via `role="img"` + `aria-label` so screen
 * readers announce the rating instead of five decorative icons.
 */
export function StarRating({ rating, label }: { rating: number; label: string }) {
  const filledCount = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <div role="img" aria-label={label} className="flex items-center gap-0.5 text-accent">
      {Array.from({ length: 5 }, (_, index) => index < filledCount).map((filled, index) => (
        <svg
          key={index}
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`size-4 ${filled ? "fill-current" : "fill-none stroke-current stroke-[1.5] opacity-40"}`}
        >
          <path d="m10 1.6 2.48 5.03 5.55.81-4.02 3.92.95 5.53L10 14.28 5.04 16.9l.95-5.53-4.02-3.92 5.55-.81L10 1.6Z" />
        </svg>
      ))}
    </div>
  );
}
