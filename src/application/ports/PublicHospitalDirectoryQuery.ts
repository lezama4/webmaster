import type { PublicHospitalProjection } from "../dto/PublicHospitalProjection";

/**
 * Dedicated public read-model port (ADR D9) — a second, independent
 * surface from `PublicEventProjectionQuery` (ADR D6). Its Prisma
 * implementation is the ONLY place permitted to read `Profile` for this
 * surface, and it returns the finished, already allow-listed shape — never
 * a Prisma model, never a partial entity. `listPublicHospitals` depends
 * only on this port.
 *
 * Non-correlation (ADR D10): this port's result MUST NOT carry any
 * Slot/Proposal/Event-derived field. See `PublicHospitalProjection`'s doc
 * comment and `tests/unit/application/nonCorrelation.test.ts`.
 */
export interface PublicHospitalDirectoryQuery {
  /** Only ACTIVE Hospital profiles, already projected to the D9 allow-list. */
  listActive(): Promise<readonly PublicHospitalProjection[]>;
}
