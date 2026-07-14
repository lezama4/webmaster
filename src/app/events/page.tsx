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

export const dynamic = "force-dynamic";

function formatDuration(minutes: number, t: Awaited<ReturnType<typeof getTranslations>>): string {
  if (minutes < 60) return t("duration.minutes", { minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? t("duration.hours", { hours }) : t("duration.hoursAndMinutes", { hours, minutes: rest });
}

export default async function EventsPage() {
  const [events, t, tAudience, locale, actor] = await Promise.all([
    listPublishedEvents(publicDeps()),
    getTranslations("Events"),
    getTranslations("Audience"),
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
    </div>
  );
}
