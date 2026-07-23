import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { listHospitalSlots } from "@application/use-cases/listHospitalSlots";
import { hospitalSlotBoardDeps } from "@infrastructure/composition/container";
import { getCurrentActorReadOnly } from "@infrastructure/http/sessionCookie";
import { audienceBadgeClasses, EmptyState } from "@ui/components/ui";
import { PublishSlotForm } from "./PublishSlotForm";
import { ProposalActions } from "./ProposalActions";
import { CloseSlotButton } from "./CloseSlotButton";

export const dynamic = "force-dynamic";

const SLOT_STATUS_PILL_CLASSES: Record<"open" | "filled" | "closed", string> = {
  open: "bg-success/12 text-success",
  filled: "bg-surface-2 text-muted",
  closed: "bg-surface-2 text-muted",
};

const PROPOSAL_STATUS_PILL_CLASSES: Record<"submitted" | "accepted" | "rejected", string> = {
  submitted: "bg-surface-2 text-muted",
  accepted: "bg-success/12 text-success",
  rejected: "bg-danger/10 text-danger",
};

const STATUS_PILL_BASE = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

export default async function HospitalSlotsPage() {
  const actor = await getCurrentActorReadOnly();
  if (!actor || actor.role !== "centre") redirect("/login");

  const [slots, t, tAudience, locale] = await Promise.all([
    listHospitalSlots(actor, hospitalSlotBoardDeps()),
    getTranslations("HospitalSlots"),
    getTranslations("Audience"),
    getLocale(),
  ]);
  const dateFormat = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3 pb-10">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="max-w-[56ch] text-muted">{t("description")}</p>
      </header>
      <div className="flex flex-col gap-8">
        <PublishSlotForm />
        {slots.length === 0 ? <EmptyState title={t("empty.title")} description={t("empty.description")} /> : (
          <ul className="flex flex-col gap-5">
            {slots.map((slot) => (
              <li key={slot.slotId} className="flex flex-col gap-5 rounded-[20px] border border-border bg-surface p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs uppercase tracking-wide text-primary">{dateFormat.format(slot.scheduledAt)}</span>
                    <h2 className="text-xl font-semibold tracking-tight">{slot.title}</h2>
                    <div className="flex items-center gap-2">
                      <span className={`${STATUS_PILL_BASE} ${SLOT_STATUS_PILL_CLASSES[slot.status]}`}>{t(`slotStatus.${slot.status}`)}</span>
                      <span className={audienceBadgeClasses}>{tAudience(slot.audience)}</span>
                    </div>
                  </div>
                  {slot.status === "open" ? <CloseSlotButton slotId={slot.slotId} /> : null}
                </div>
                {slot.proposals.length === 0 ? <p className="text-sm text-muted">{t("noProposals")}</p> : (
                  <ul className="flex flex-col gap-3 border-t border-border pt-4">
                    {slot.proposals.map((proposal) => (
                      <li key={proposal.proposalId} className="flex flex-col gap-3 rounded-[20px] bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-1"><span className="font-medium">{proposal.artistDisplayName}</span><span className="text-sm text-muted">{proposal.message}</span></div>
                        {proposal.status === "submitted" && slot.status === "open" ? <ProposalActions slotId={slot.slotId} proposalId={proposal.proposalId} /> : <span className={`${STATUS_PILL_BASE} ${PROPOSAL_STATUS_PILL_CLASSES[proposal.status]}`}>{t(`proposalStatus.${proposal.status}`)}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
