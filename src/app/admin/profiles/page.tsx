import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { listPendingProfiles } from "@application/use-cases/listPendingProfiles";
import { listActiveProfiles } from "@application/use-cases/listActiveProfiles";
import { activeProfilesDeps, pendingProfilesDeps } from "@infrastructure/composition/container";
import { getCurrentActorReadOnly } from "@infrastructure/http/sessionCookie";
import { EmptyState } from "@ui/components/ui";
import { ProfileRowActions } from "./ProfileRowActions";

export const dynamic = "force-dynamic";

export default async function AdminProfilesPage() {
  const actor = await getCurrentActorReadOnly();
  if (!actor || actor.role !== "admin") redirect("/login");

  const [pending, active, t, locale] = await Promise.all([
    listPendingProfiles(actor, pendingProfilesDeps()),
    listActiveProfiles(actor, activeProfilesDeps()),
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
      {/*
        `id="pending-profiles"` (auditable-profile-approval, PR4) lets e2e
        helpers scope a row lookup to THIS list specifically — once a
        profile is approved it moves to the ACTIVE section below and its
        displayName appears again there, so an unscoped `<li>` text filter
        would (wrongly) still find one match after approval.
      */}
      <section id="pending-profiles">
        {pending.length === 0 ? (
          <EmptyState title={t("empty.title")} description={t("empty.description")} />
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.map((profile) => (
              <li key={profile.profileId} className="flex flex-col gap-4 rounded-[20px] border border-border bg-surface p-6 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs uppercase tracking-wide text-primary">
                    {profile.type === "centre" && profile.centreType
                      ? t(`centreType.${profile.centreType}`)
                      : t(`types.${profile.type}`)}
                  </span>
                  <span className="text-lg font-medium">{profile.displayName}</span>
                  <span className="text-sm text-muted">{t("requested", { date: dateFormat.format(profile.requestedAt) })}</span>
                </div>
                <ProfileRowActions
                  profileId={profile.profileId}
                  profileType={profile.type}
                  actions={["approve", "reject"]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        Minimal ACTIVE-profile section (auditable-profile-approval, PR4/5.6)
        — closes the "no deactivate UI exists anywhere" scope gap surfaced
        during Phase 5's read: previously only the API route could exercise
        `deactivateProfile`. Deliberately the SMALLEST addition that lets an
        admin deactivate-with-basis end-to-end: a second flat list on the
        same page, reusing `ProfileRowActions`' basis-gated pattern — NOT a
        full active-centres management page (search, pagination, review
        history), which is out of this change's scope.
      */}
      <section id="active-profiles" className="flex flex-col gap-3 pt-14">
        <header className="flex flex-col gap-2">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">{t("active.title")}</h2>
          <p className="max-w-[56ch] text-muted">{t("active.description")}</p>
        </header>
        {active.length === 0 ? (
          <EmptyState title={t("active.empty.title")} description={t("active.empty.description")} />
        ) : (
          <ul className="flex flex-col gap-4">
            {active.map((profile) => (
              <li key={profile.profileId} className="flex flex-col gap-4 rounded-[20px] border border-border bg-surface p-6 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs uppercase tracking-wide text-primary">
                    {profile.type === "centre" && profile.centreType
                      ? t(`centreType.${profile.centreType}`)
                      : t(`types.${profile.type}`)}
                  </span>
                  <span className="text-lg font-medium">{profile.displayName}</span>
                </div>
                <ProfileRowActions
                  profileId={profile.profileId}
                  profileType={profile.type}
                  actions={["deactivate"]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
