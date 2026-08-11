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
 * D10 second revision (`centre-event-counts`): this adapter now reads ONE
 * Slot/Event-derived value — `_count.slots`, the number of published,
 * still-upcoming events the centre hosts. It is an aggregate: no title, no
 * date, no Slot `location`, no Proposal, no id ever crosses this boundary,
 * and the count is computed IN Postgres so no event row is materialised in
 * the app at all. The same number was already obtainable from
 * `/events?centre=<name>`, so this exposes nothing new — see the DTO's doc
 * comment and `tests/unit/application/nonCorrelation.test.ts`.
 */
export class PrismaPublicHospitalDirectoryQuery
  implements PublicHospitalDirectoryQuery
{
  constructor(private readonly client: PrismaClientOrTx) {}

  async listActive(): Promise<readonly PublicHospitalProjection[]> {
    // "Upcoming" is evaluated against a single timestamp taken once, so every
    // row in one response is counted against the same instant.
    const now = new Date();
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
        // Slot<->Event is 1:1, so counting this centre's future slots that
        // carry a PUBLISHED event counts exactly its upcoming public events.
        // Aggregated by Postgres — the event rows themselves never load.
        _count: {
          select: {
            slots: {
              where: {
                scheduledAt: { gte: now },
                event: { is: { status: "PUBLISHED" } },
              },
            },
          },
        },
      },
      // Ordering derived ONLY from allow-listed fields (D9) — never
      // `createdAt`/`id`, which would weakly encode registration/seed
      // order, exactly the kind of incidental signal D10 exists to keep
      // out. Verified at runtime by Phase 0.1/3.1 against real Postgres.
      // This is the tie-break; centres that actually have something coming up
      // are lifted above it in JS below.
      orderBy: [{ city: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    });

    const projections = rows.map((row): PublicHospitalProjection => {
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
        upcomingEventCount: row._count.slots,
      };
    });

    // Centres that actually have something coming up are listed first — a
    // family arriving here is looking for an activity, and a directory that
    // opens with a screenful of empty centres buries the useful ones.
    //
    // A BOOLEAN group, deliberately not a ranking by count: ordering centres
    // by how busy they are would editorialise about the institutions, which
    // this surface has no business doing. Within each group the D9 ordering
    // above (city asc, nulls last, then name asc) is preserved, because
    // `Array.prototype.sort` is stable — so the neutral order still decides
    // everything except "has something to offer or not".
    //
    // Sorted here rather than in SQL because the count is a FILTERED relation
    // count (upcoming + published), which Prisma cannot order by; and here
    // rather than in the page so `/api/hospitals` and the rendered directory
    // never disagree. The directory is a handful of rows, so the cost is nil.
    return projections.sort(
      (a, b) => Number(b.upcomingEventCount > 0) - Number(a.upcomingEventCount > 0),
    );
  }
}
