/**
 * A single Proposal against a Hospital-owned Slot, as surfaced on the
 * Hospital's own slot board (5.4/5.6/5.10) — an explicit ALLOW-LIST.
 * Forbidden, always: the Artist's email or any internal Account/Profile id
 * beyond what the approve/reject routes key on (`proposalId`).
 */
export interface HospitalSlotProposalView {
  readonly proposalId: string;
  readonly artistDisplayName: string;
  readonly message: string;
  readonly status: "submitted" | "accepted" | "rejected";
}

/**
 * A Hospital's own Slot, with its Proposals, as surfaced on the Hospital's
 * slot board — scoped to ONE Hospital's own Slots only (never another
 * Hospital's). Forbidden, always: the owning Hospital's own internal ids
 * beyond `slotId`, and any field not needed to render/act on the board.
 */
export interface HospitalSlotView {
  readonly slotId: string;
  readonly title: string;
  readonly scheduledAt: Date;
  readonly status: "open" | "filled" | "closed";
  readonly proposals: readonly HospitalSlotProposalView[];
}
