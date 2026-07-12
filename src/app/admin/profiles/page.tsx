import { redirect } from "next/navigation";
import { listPendingProfiles } from "@application/use-cases/listPendingProfiles";
import { pendingProfilesDeps } from "@infrastructure/composition/container";
import { getCurrentActorReadOnly } from "@infrastructure/http/sessionCookie";
import { EmptyState } from "@ui/components/ui";
import { ProfileRowActions } from "./ProfileRowActions";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const TYPE_LABEL: Record<string, string> = {
  hospital: "Hospital",
  artist: "Artist",
};

export default async function AdminProfilesPage() {
  const actor = await getCurrentActorReadOnly();
  if (!actor || actor.role !== "admin") {
    redirect("/login");
  }

  const pending = await listPendingProfiles(actor, pendingProfilesDeps());

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3 pb-10">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Profile validation queue
        </h1>
        <p className="max-w-[56ch] text-muted">
          Review hospitals and artists waiting for approval. Profiles that
          register again after a rejection show up here too — same queue, no
          separate list.
        </p>
      </header>

      {pending.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description="New hospital and artist registrations will appear here as soon as they come in."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {pending.map((profile) => (
            <li
              key={profile.profileId}
              className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-6 shadow-[0_16px_40px_-28px_rgba(42,33,28,0.35)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs uppercase tracking-wide text-primary">
                  {TYPE_LABEL[profile.type] ?? profile.type}
                </span>
                <span className="text-lg font-medium">{profile.displayName}</span>
                <span className="text-sm text-muted">
                  Requested {dateFormat.format(profile.requestedAt)}
                </span>
              </div>
              <ProfileRowActions profileId={profile.profileId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
