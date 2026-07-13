import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { listOpenSlots } from "@application/use-cases/listOpenSlots";
import { openSlotsDeps } from "@infrastructure/composition/container";
import { getCurrentActorReadOnly } from "@infrastructure/http/sessionCookie";
import { EmptyState } from "@ui/components/ui";
import { ProposeActivityForm } from "./ProposeActivityForm";

export const dynamic = "force-dynamic";

function formatDuration(minutes: number, t: Awaited<ReturnType<typeof getTranslations>>): string {
  if (minutes < 60) return t("duration.minutes", { minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? t("duration.hours", { hours }) : t("duration.hoursAndMinutes", { hours, minutes: rest });
}

export default async function ArtistSlotsPage() {
  const actor = await getCurrentActorReadOnly();
  if (!actor || actor.role !== "artist") redirect("/login");

  const [slots, t, locale] = await Promise.all([listOpenSlots(actor, openSlotsDeps()), getTranslations("ArtistSlots"), getLocale()]);
  const dateFormat = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3 pb-10">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="max-w-[56ch] text-muted">{t("description")}</p>
      </header>
      {slots.length === 0 ? <EmptyState title={t("empty.title")} description={t("empty.description")} /> : (
        <ul className="flex flex-col gap-5">
          {slots.map((slot) => (
            <li key={slot.id} className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-6 shadow-[0_16px_40px_-28px_rgba(42,33,28,0.35)] sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3"><span className="font-mono text-xs uppercase tracking-wide text-primary">{dateFormat.format(slot.scheduledAt)}</span><span className="text-xs text-muted">{formatDuration(slot.durationMinutes, t)}</span></div>
                <h2 className="text-xl font-semibold tracking-tight">{slot.title}</h2>
                <p className="text-muted">{slot.description}</p>
                <p className="text-sm"><span className="text-muted">{t("at")} </span><span className="font-medium">{slot.hospitalName}</span><span className="text-muted"> · {slot.location}</span></p>
              </div>
              <div className="flex-shrink-0"><ProposeActivityForm slotId={slot.id} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
