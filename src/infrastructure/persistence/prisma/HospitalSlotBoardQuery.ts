import type {
  HospitalSlotProposalView,
  HospitalSlotView,
} from "@application/dto/HospitalSlotView";
import type { HospitalSlotBoardQuery } from "@application/ports/HospitalSlotBoardQuery";
import type { PrismaClientOrTx } from "./client";

const SLOT_STATUS_TO_DOMAIN = {
  OPEN: "open",
  FILLED: "filled",
  CLOSED: "closed",
} as const;

const PROPOSAL_STATUS_TO_DOMAIN = {
  SUBMITTED: "submitted",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
} as const;

/**
 * The Hospital's own slot board adapter (5.4/5.6/5.10). Joins Slot ->
 * Proposal -> (Artist) Profile in ONE query, scoped to the requested
 * `hospitalProfileId` (never another Hospital's Slots), using a Prisma
 * `select` (never `include`) so the Artist's email/internal ids never leave
 * Postgres. Builds the returned `HospitalSlotView`/`HospitalSlotProposalView`
 * as FRESH object literals, field by field — never a spread of the query
 * result. Ordered by `scheduledAt`.
 */
export class PrismaHospitalSlotBoardQuery implements HospitalSlotBoardQuery {
  constructor(private readonly client: PrismaClientOrTx) {}

  async listForHospital(
    hospitalProfileId: string,
  ): Promise<readonly HospitalSlotView[]> {
    const rows = await this.client.slot.findMany({
      where: { hospitalProfileId },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        status: true,
        proposals: {
          select: {
            id: true,
            message: true,
            status: true,
            artistProfile: {
              select: { name: true },
            },
          },
        },
      },
    });

    return rows.map((row): HospitalSlotView => ({
      slotId: row.id,
      title: row.title,
      scheduledAt: row.scheduledAt,
      status: SLOT_STATUS_TO_DOMAIN[row.status],
      proposals: row.proposals.map(
        (proposal): HospitalSlotProposalView => ({
          proposalId: proposal.id,
          artistDisplayName: proposal.artistProfile.name,
          message: proposal.message,
          status: PROPOSAL_STATUS_TO_DOMAIN[proposal.status],
        }),
      ),
    }));
  }
}
