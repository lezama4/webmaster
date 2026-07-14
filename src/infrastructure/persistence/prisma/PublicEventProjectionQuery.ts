import type { PublicEventProjection } from "@application/dto/PublicEventProjection";
import type { PublicEventProjectionQuery } from "@application/ports/PublicEventProjectionQuery";
import type { PrismaClientOrTx } from "./client";
import { toDomainAudience } from "./mappers";

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

  async listPublished(): Promise<readonly PublicEventProjection[]> {
    const rows = await this.client.event.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        slot: {
          select: {
            description: true,
            scheduledAt: true,
            durationMinutes: true,
            audience: true,
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
        averageStars,
        ratingCount,
      };
    });
  }
}
