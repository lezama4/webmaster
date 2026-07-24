import type { ActiveProfileView } from "../dto/ActiveProfileView";

/**
 * Dedicated read-model port for the Admin active-profile listing
 * (auditable-profile-approval, PR4/5.6 — the deactivate-UI scope gap). Its
 * Prisma implementation returns the finished, already allow-listed shape —
 * never a Prisma model, never a partial entity.
 */
export interface ActiveProfileQuery {
  /** Every Profile whose status is `active`. Ordering is the adapter's responsibility. */
  listActive(): Promise<readonly ActiveProfileView[]>;
}
