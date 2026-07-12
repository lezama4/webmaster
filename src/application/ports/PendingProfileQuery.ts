import type { PendingProfileView } from "../dto/PendingProfileView";

/**
 * Dedicated read-model port for the Admin pending-profile queue (5.3/5.12).
 * Its Prisma implementation returns the finished, already allow-listed
 * shape — never a Prisma model, never a partial entity — and is responsible
 * for ordering the result by `requestedAt` ascending (oldest first).
 */
export interface PendingProfileQuery {
  /**
   * Every Profile whose status is `pending` — this INCLUDES Profiles that
   * re-entered review via `rejected -> pending` (5.12): the SAME queue, no
   * separate path. Ordered by `requestedAt` ascending (oldest first).
   */
  listPending(): Promise<readonly PendingProfileView[]>;
}
