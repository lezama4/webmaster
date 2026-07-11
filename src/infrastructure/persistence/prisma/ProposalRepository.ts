import type { Proposal } from "@domain/proposal/Proposal";
import type { ProposalRepository } from "@application/ports/ProposalRepository";
import type { PrismaClientOrTx } from "./client";
import { proposalStatusToPrisma, toDomainProposal } from "./mappers";

/** Prisma adapter for `ProposalRepository` (Phase 4). Standalone reads only — Proposal-mutating writes for the Slot-decision flows go through `MatchingUnitOfWork.withLockedSlot` (ADR D4), never `save` directly, outside of the seed script. */
export class PrismaProposalRepository implements ProposalRepository {
  constructor(private readonly client: PrismaClientOrTx) {}

  async findById(id: string): Promise<Proposal | null> {
    const row = await this.client.proposal.findUnique({ where: { id } });
    return row ? toDomainProposal(row) : null;
  }

  async listBySlotId(slotId: string): Promise<readonly Proposal[]> {
    const rows = await this.client.proposal.findMany({ where: { slotId } });
    return rows.map(toDomainProposal);
  }

  async save(proposal: Proposal): Promise<void> {
    const data = {
      slotId: proposal.slotId,
      artistProfileId: proposal.artistProfileId,
      message: proposal.message,
      status: proposalStatusToPrisma(proposal.status),
    };
    await this.client.proposal.upsert({
      where: { id: proposal.id },
      create: { id: proposal.id, ...data },
      update: data,
    });
  }
}
