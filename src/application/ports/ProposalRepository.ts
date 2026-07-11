import type { Proposal } from "@domain/proposal/Proposal";

export interface ProposalRepository {
  findById(id: string): Promise<Proposal | null>;
  /** The COMPLETE Proposal set for a Slot (cascades require completeness, M4). */
  listBySlotId(slotId: string): Promise<readonly Proposal[]>;
  save(proposal: Proposal): Promise<void>;
}
