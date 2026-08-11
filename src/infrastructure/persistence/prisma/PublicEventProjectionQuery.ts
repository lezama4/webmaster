import type { PublicEventProjection } from "@application/dto/PublicEventProjection";
import type {
  PublicEventFilters,
  PublicEventProjectionQuery,
} from "@application/ports/PublicEventProjectionQuery";
import type { PrismaClientOrTx } from "./client";
import { audienceToPrisma, toDomainAudience } from "./mappers";

/**
 * The ONLY adapter permitted to join Event -> Slot -> Proposal -> (Artist)
 * Profile (ADR D6, M6 pr2-review). Uses a Prisma `select` (never `include`)
 * so `location`/`message`/ids/email never leave Postgres, and builds the
 * returned `PublicEventProjection` as a FRESH object literal, field by
 * field — never a spread of the query result — so a future accidental
 * widening of the `select` cannot leak an extra property through this
 * boundary at runtime (defense-in-depth beyond the TypeScript type).
 *
 * Phase 3/Block 2 addition: also selects the Event's OWN `id` (needed so a
 * client can `POST /api/events/[id]/rate`) and its `ratings` — but ONLY the
 * `stars` scalar of each Rating, never `raterAccountId` or any other field
 * — reduced in JS to `averageStars`/`ratingCount`. No individual Rating row
 * or rater identity is ever part of the returned `PublicEventProjection`.
 */
export class PrismaPublicEventProjectionQuery
  implements PublicEventProjectionQuery
{
  constructor(private readonly client: PrismaClientOrTx) {}

  async listPublished(
    filters?: PublicEventFilters,
  ): Promise<readonly PublicEventProjection[]> {
    // Filters apply to the related Slot (audience + scheduledAt live there;
    // the hosting centre is Slot.hospitalProfile). Every axis filters on a
    // value already in the public projection — since the D10 revision that
    // includes the centre's public `name` — so filtering exposes nothing the
    // listing does not already show, and never touches the ward/room
    // `location`, postal code or address.
    // The public listing is "upcoming events": an event that already happened
    // is never shown. This floor lives HERE, not in the page, so no caller can
    // forget it — `GET /api/events` passes no filters at all and would
    // otherwise have served past events while the page hid them. A
    // caller-supplied `from` may only narrow the window further; it can never
    // widen it back into the past.
    const now = new Date();
    const from = filters?.from && filters.from > now ? filters.from : now;
    const scheduledAt = {
      gte: from,
      ...(filters?.to ? { lte: filters.to } : {}),
    };
    const slotFilter = {
      ...(filters?.audience ? { audience: audienceToPrisma(filters.audience) } : {}),
      scheduledAt,
      ...(filters?.centre ? { hospitalProfile: { name: filters.centre } } : {}),
    };

    const rows = await this.client.event.findMany({
      where: {
        status: "PUBLISHED",
        // Always present: `slotFilter` now always carries at least the
        // upcoming-only floor above.
        slot: slotFilter,
      },
      select: {
        id: true,
        title: true,
        slot: {
          select: {
            description: true,
            scheduledAt: true,
            durationMinutes: true,
            audience: true,
            capacity: true,
            // D10 revision: the hosting centre's PUBLIC name + city only.
            // `location` (ward/room), postalCode and addressLine are NOT
            // selected — they never leave Postgres for the public surface.
            hospitalProfile: {
              select: { name: true, city: true },
            },
          },
        },
        proposal: {
          select: {
            artistProfile: {
              select: { name: true },
            },
          },
        },
        ratings: {
          select: { stars: true },
        },
      },
    });

    return rows.map((row): PublicEventProjection => {
      const stars = row.ratings.map((r) => r.stars);
      const ratingCount = stars.length;
      const averageStars =
        ratingCount === 0
          ? null
          : Math.round((stars.reduce((sum, s) => sum + s, 0) / ratingCount) * 10) / 10;

      return {
        id: row.id,
        title: row.title,
        description: row.slot.description,
        scheduledAt: row.slot.scheduledAt,
        durationMinutes: row.slot.durationMinutes,
        artistName: row.proposal.artistProfile.name,
        audience: toDomainAudience(row.slot.audience),
        capacity: row.slot.capacity,
        centreName: row.slot.hospitalProfile.name,
        centreCity: row.slot.hospitalProfile.city,
        averageStars,
        ratingCount,
      };
    });
  }
}
