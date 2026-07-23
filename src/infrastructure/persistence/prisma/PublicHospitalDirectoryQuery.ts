import type { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";
import type { PublicHospitalDirectoryQuery } from "@application/ports/PublicHospitalDirectoryQuery";
import type { PrismaClientOrTx } from "./client";
import { toDomainCentreType } from "./mappers";

/**
 * The ONLY adapter permitted to read `Profile` for the public hospital
 * directory surface (ADR D9) — a second, independent read model from
 * `PrismaPublicEventProjectionQuery` (ADR D6). Uses a Prisma `select`
 * (never `include`) so `addressLine`, email, and every internal id never
 * leave Postgres, and builds the returned `PublicHospitalProjection` as a
 * FRESH object literal, field by field — never a spread of the query
 * result — so a future accidental widening of the `select` cannot leak an
 * extra property through this boundary at runtime (defense-in-depth beyond
 * the TypeScript type, mirroring the Events adapter's pr2a-B1 pattern).
 *
 * Non-correlation (ADR D10): this adapter MUST NOT join Slot/Proposal/Event
 * — it reads only `Profile` columns. See
 * `tests/unit/application/nonCorrelation.test.ts`.
 */
export class PrismaPublicHospitalDirectoryQuery
  implements PublicHospitalDirectoryQuery
{
  constructor(private readonly client: PrismaClientOrTx) {}

  async listActive(): Promise<readonly PublicHospitalProjection[]> {
    const rows = await this.client.profile.findMany({
      // Security predicate (D9) — the SOLE reason a PENDING/REJECTED/
      // DEACTIVATED profile, or an Artist profile, cannot reach the public
      // directory. Must never acquire an unrelated condition.
      where: { type: "CENTRE", status: "ACTIVE" },
      select: {
        name: true,
        city: true,
        postalCode: true,
        latitude: true,
        longitude: true,
        centreType: true,
      },
      // Ordering derived ONLY from allow-listed fields (D9) — never
      // `createdAt`/`id`, which would weakly encode registration/seed
      // order, exactly the kind of incidental signal D10 exists to keep
      // out. Verified at runtime by Phase 0.1/3.1 against real Postgres.
      orderBy: [{ city: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    });

    return rows.map((row): PublicHospitalProjection => {
      // D16 invariant: every `type: CENTRE` row carries a non-null
      // `centreType` (enforced at write time by the domain factory and
      // backfilled by the D17 migration). A null here would mean that
      // invariant was violated at the data layer — fail loudly rather than
      // silently coercing to a made-up value.
      if (row.centreType === null) {
        throw new Error(
          `Profile '${row.name}' has type CENTRE but a null centreType — D16 invariant violated`,
        );
      }
      return {
        name: row.name,
        city: row.city,
        postalCode: row.postalCode,
        latitude: row.latitude,
        longitude: row.longitude,
        centreType: toDomainCentreType(row.centreType),
      };
    });
  }
}
