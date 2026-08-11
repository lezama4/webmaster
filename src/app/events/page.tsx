import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { listPublishedEvents } from "@application/use-cases/listPublishedEvents";
import { listMyEventRatings } from "@application/use-cases/listMyEventRatings";
import {
  listMyEventRatingsDeps,
  publicDeps,
} from "@infrastructure/composition/container";
import { getCurrentActorReadOnly } from "@infrastructure/http/sessionCookie";
import type { Audience } from "@domain/slot/Slot";
import { audienceBadgeClasses, EmptyState, inputClasses, secondaryButton } from "@ui/components/ui";
import { StarRating } from "../StarRating";
import { RateEventControl } from "./RateEventControl";
import { ShareRow } from "@ui/share/ShareRow";
import { absoluteUrl, buildPageMetadata, SITE_NAME } from "@/app/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [t, tHome] = await Promise.all([getTranslations("Events"), getTranslations("Home")]);
  return buildPageMetadata({
    pageTitle: t("title"),
    // Reuses the on-page description verbatim (D10): it already mentions
    // "participating care centres" only as a generic category, never a named
    // one — introducing a SEPARATE OG/share string here would just be a
    // new surface to re-audit for the same non-correlation invariant.
    // See tests/unit/application/nonCorrelation.test.ts and
    // e2e/non-correlation.spec.ts for the enforcement.
    description: t("description"),
    path: "/events",
    imageAlt: tHome("hero.imageAlt"),
  });
}

function formatDuration(minutes: number, t: Awaited<ReturnType<typeof getTranslations>>): string {
  if (minutes < 60) return t("duration.minutes", { minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? t("duration.hours", { hours }) : t("duration.hoursAndMinutes", { hours, minutes: rest });
}

// Public-safe filters (date + audience) — never centre/location (D10).
const AUDIENCE_VALUES = ["all_ages", "early_childhood", "children", "teens", "adults"] as const;
type DatePreset = "all" | "week" | "month";

function parseAudience(value: string | undefined): Audience | undefined {
  return (AUDIENCE_VALUES as readonly string[]).includes(value ?? "")
    ? (value as Audience)
    : undefined;
}

function parseDatePreset(value: string | undefined): DatePreset {
  return value === "week" || value === "month" ? value : "all";
}

/**
 * "All dates" means all UPCOMING dates: past events are excluded by the query
 * adapter itself for every caller (see `PrismaPublicEventProjectionQuery`), so
 * this returns no bound and the floor still applies. The presets only narrow
 * the window further.
 */
function dateRange(preset: DatePreset, now: Date): { from?: Date; to?: Date } {
  if (preset === "all") return {};
  const to = new Date(now);
  to.setDate(to.getDate() + (preset === "week" ? 7 : 30));
  return { from: now, to };
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; audience?: string; centre?: string }>;
}) {
  const sp = await searchParams;
  const audienceFilter = parseAudience(sp.audience);
  const datePreset = parseDatePreset(sp.date);
  const { from, to } = dateRange(datePreset, new Date());

  // One unfiltered read supplies the centre dropdown's options (the distinct
  // public centre names that host a published event). The centre filter matches
  // that public name only — the event→centre link the D10 revision made public.
  const [allEvents, t, tAudience, tShare, locale, actor] = await Promise.all([
    listPublishedEvents(publicDeps()),
    getTranslations("Events"),
    getTranslations("Audience"),
    getTranslations("Share"),
    getLocale(),
    getCurrentActorReadOnly(),
  ]);
  const centreOptions = [...new Set(allEvents.map((event) => event.centreName))].sort(
    (a, b) => a.localeCompare(b, locale),
  );
  const centreFilter =
    sp.centre && centreOptions.includes(sp.centre) ? sp.centre : undefined;
  const filters = {
    ...(audienceFilter ? { audience: audienceFilter } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(centreFilter ? { centre: centreFilter } : {}),
  };
  // Reuse the unfiltered read when no filter is active; otherwise query again.
  const events =
    Object.keys(filters).length > 0
      ? await listPublishedEvents(publicDeps(), filters)
      : allEvents;
  // Pre-fills each event's interactive star control with the CALLER'S OWN
  // rating only (never another rater's) — anonymous visitors see the
  // read-only average instead, no fetch needed.
  const myRatings = actor
    ? await listMyEventRatings(actor, listMyEventRatingsDeps())
    : null;
  const dateFormat = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-5 pb-10">
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
          <p className="max-w-[52ch] text-muted">{t("description")}</p>
        </div>
        {/* Public-safe filters. A plain GET form (no client JS): submitting
            reloads /events?date=…&audience=…&centre=… and the server filters
            the query. Every axis filters on a value already shown on the card
            (date, audience, and — since the D10 revision — the hosting centre's
            public name); the ward/room location, postal code and address are
            never filterable because they are never in the projection. Centre
            is the PRIMARY filter (its own row, above the other two) and appears
            only when more than one centre hosts events. */}
        <form method="get" className="flex flex-col gap-3">
          {/* Centre is the PRIMARY filter — its own row, above date + audience.
              Only rendered when more than one centre hosts events. */}
          {centreOptions.length > 1 ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("filters.centreLabel")}</span>
              <select
                name="centre"
                defaultValue={centreFilter ?? "all"}
                className={`${inputClasses} sm:min-w-[18rem]`}
              >
                <option value="all">{t("filters.allCentres")}</option>
                {centreOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">{t("filters.dateLabel")}</span>
              <select name="date" defaultValue={datePreset} className={inputClasses}>
                <option value="all">{t("filters.allDates")}</option>
                <option value="week">{t("filters.week")}</option>
                <option value="month">{t("filters.month")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">{t("filters.audienceLabel")}</span>
              <select
                name="audience"
                defaultValue={audienceFilter ?? "all"}
                className={inputClasses}
              >
                <option value="all">{t("filters.allAudiences")}</option>
                {AUDIENCE_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {tAudience(value)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={secondaryButton}>
              {t("filters.apply")}
            </button>
          </div>
        </form>
      </header>

      {events.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} action={<Link href="/register" className={secondaryButton}>{t("empty.action")}</Link>} />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs uppercase tracking-wide text-primary">{dateFormat.format(event.scheduledAt)}</span>
                <span className="text-xs text-muted">{formatDuration(event.durationMinutes, t)}</span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight">{event.title}</h2>
              <p className="text-muted">{event.description}</p>
              <span className={audienceBadgeClasses}>{tAudience(event.audience)}</span>
              <p className="text-sm"><span className="text-muted">{t("withArtist")} </span><span className="font-medium">{event.artistName}</span></p>
              <p className="text-sm"><span className="text-muted">{t("atCentre")} </span><span className="font-medium">{event.centreName}</span>{event.centreCity ? <span className="text-muted"> · {event.centreCity}</span> : null}</p>
              {event.capacity != null ? <p className="text-sm"><span className="text-muted">{t("capacity")} </span><span className="font-medium">{t("capacityValue", { count: event.capacity })}</span></p> : null}

              <div className="mt-auto flex items-center gap-2 text-sm">
                {event.averageStars === null ? (
                  <span className="text-muted">{t("rating.noRatings")}</span>
                ) : (
                  <>
                    <StarRating rating={event.averageStars} label={t("rating.averageLabel", { value: event.averageStars })} />
                    <span className="text-muted">{t("rating.average", { average: event.averageStars, count: event.ratingCount })}</span>
                  </>
                )}
              </div>

              {actor ? (
                <RateEventControl eventId={event.id} initialStars={myRatings?.[event.id] ?? null} />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* Discreet, page-level share row (product decision — page-level
          only, not per-event: PublicEventProjection carries no public id
          to deep-link to, see ADR D10). Reuses Events.description as the
          share message — same D10 rationale as generateMetadata above. */}
      <div className="mt-16 flex flex-col gap-3 border-t border-border pt-8">
        <p className="text-sm font-medium text-foreground">{tShare("heading")}</p>
        <ShareRow url={absoluteUrl("/events")} title={`${SITE_NAME} — ${t("title")}`} text={t("description")} />
      </div>
    </div>
  );
}
