import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { listPublishedEvents } from "@application/use-cases/listPublishedEvents";
import { publicDeps } from "@infrastructure/composition/container";
import { EmptyState, secondaryButton } from "@ui/components/ui";

export const dynamic = "force-dynamic";

function formatDuration(minutes: number, t: Awaited<ReturnType<typeof getTranslations>>): string {
  if (minutes < 60) return t("duration.minutes", { minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? t("duration.hours", { hours }) : t("duration.hoursAndMinutes", { hours, minutes: rest });
}

export default async function EventsPage() {
  const [events, t, locale] = await Promise.all([
    listPublishedEvents(publicDeps()),
    getTranslations("Events"),
    getLocale(),
  ]);
  const dateFormat = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3 pb-10">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="max-w-[52ch] text-muted">{t("description")}</p>
      </header>

      {events.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} action={<Link href="/register" className={secondaryButton}>{t("empty.action")}</Link>} />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {events.map((event, index) => (
            <li key={`${event.title}-${index}`} className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-6 shadow-[0_16px_40px_-28px_rgba(42,33,28,0.35)]">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs uppercase tracking-wide text-primary">{dateFormat.format(event.scheduledAt)}</span>
                <span className="text-xs text-muted">{formatDuration(event.durationMinutes, t)}</span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight">{event.title}</h2>
              <p className="text-muted">{event.description}</p>
              <p className="mt-auto text-sm"><span className="text-muted">{t("withArtist")} </span><span className="font-medium">{event.artistName}</span></p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
