import type { HospitalSlotView } from "../dto/HospitalSlotView";

/**
 * Dedicated read-model port for the Hospital's own slot board (5.4/5.6/
 * 5.10). Its Prisma implementation joins Slot -> Proposal -> (Artist)
 * Profile in ONE query, scoped to a single owning Hospital Profile, and
 * returns the finished, already-joined, allow-listed shape ordered by
 * `scheduledAt`.
 */
export interface HospitalSlotBoardQuery {
  /** Every Slot owned by `hospitalProfileId`, with its Proposals, ordered by `scheduledAt`. */
  listForHospital(
    hospitalProfileId: string,
  ): Promise<readonly HospitalSlotView[]>;
}
