import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { listPendingProfiles } from "@application/use-cases/listPendingProfiles";
import { pendingProfilesDeps } from "@infrastructure/composition/container";
import { getCurrentActorReadOnly } from "@infrastructure/http/sessionCookie";
import { EmptyState } from "@ui/components/ui";
import { ProfileRowActions } from "./ProfileRowActions";

export const dynamic = "force-dynamic";

export default async function AdminProfilesPage() {
  const actor = await getCurrentActorReadOnly();
  if (!actor || actor.role !== "admin") redirect("/login");

  const [pending, t, locale] = await Promise.all([
    listPendingProfiles(actor, pendingProfilesDeps()),
    getTranslations("AdminProfiles"),
    getLocale(),
  ]);
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3 pb-10">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="max-w-[56ch] text-muted">{t("description")}</p>
      </header>
      {pending.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <ul className="flex flex-col gap-4">
          {pending.map((profile) => (
            <li key={profile.profileId} className="flex flex-col gap-4 rounded-[20px] border border-border bg-surface p-6 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs uppercase tracking-wide text-primary">{t(`types.${profile.type}`)}</span>
                <span className="text-lg font-medium">{profile.displayName}</span>
                <span className="text-sm text-muted">{t("requested", { date: dateFormat.format(profile.requestedAt) })}</span>
              </div>
              <ProfileRowActions profileId={profile.profileId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
