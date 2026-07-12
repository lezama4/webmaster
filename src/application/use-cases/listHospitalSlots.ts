import type { HospitalSlotView } from "@application/dto/HospitalSlotView";
import type { HospitalSlotBoardQuery } from "@application/ports/HospitalSlotBoardQuery";
import type { ProfileRepository } from "@application/ports/ProfileRepository";
import type { Actor } from "@application/Actor";
import { assertActiveProfile, assertRole } from "./shared/guards";

export interface ListHospitalSlotsDeps {
  readonly profiles: ProfileRepository;
  readonly hospitalSlotBoardQuery: HospitalSlotBoardQuery;
}

/**
 * Hospital-authenticated slot board (5.4/5.6/5.10) — scoped to ONE
 * Hospital's own Slots only. A read-only listing: no lock is taken here;
 * the mutating use cases (`publishSlot`/`approveProposal`/`rejectProposal`/
 * `closeSlot`) already re-check live status/ownership under
 * `MatchingUnitOfWork.withLockedSlot` at decision time, so this listing
 * never needs to.
 *
 * Mirrors `listPublishedEvents`'s D6/pr2a-B1 discipline: rebuilds a FRESH
 * DTO field-by-field (Slot AND every nested Proposal) via
 * `toHospitalSlotView`, discarding any other property a hostile or
 * accidentally-widened adapter might have supplied.
 */
export async function listHospitalSlots(
  actor: Actor,
  deps: ListHospitalSlotsDeps,
): Promise<readonly HospitalSlotView[]> {
  assertRole(actor, "hospital");
  const profile = actor.profileId
    ? await deps.profiles.findById(actor.profileId)
    : null;
  const activeProfile = assertActiveProfile(profile, "hospital");

  const records = await deps.hospitalSlotBoardQuery.listForHospital(
    activeProfile.id,
  );
  return records.map(toHospitalSlotView);
}

function toHospitalSlotView(record: HospitalSlotView): HospitalSlotView {
  return {
    slotId: record.slotId,
    title: record.title,
    scheduledAt: record.scheduledAt,
    status: record.status,
    proposals: record.proposals.map((proposal) => ({
      proposalId: proposal.proposalId,
      artistDisplayName: proposal.artistDisplayName,
      message: proposal.message,
      status: proposal.status,
    })),
  };
}
