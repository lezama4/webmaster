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
import { audienceBadgeClasses, EmptyState, secondaryButton } from "@ui/components/ui";
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

export default async function EventsPage() {
  const [events, t, tAudience, tShare, locale, actor] = await Promise.all([
    listPublishedEvents(publicDeps()),
    getTranslations("Events"),
    getTranslations("Audience"),
    getTranslations("Share"),
    getLocale(),
    getCurrentActorReadOnly(),
  ]);
  // Pre-fills each event's interactive star control with the CALLER'S OWN
  // rating only (never another rater's) — anonymous visitors see the
  // read-only average instead, no fetch needed.
  const myRatings = actor
    ? await listMyEventRatings(actor, listMyEventRatingsDeps())
    : null;
  const dateFormat = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3 pb-10">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="max-w-[52ch] text-muted">{t("description")}</p>
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
