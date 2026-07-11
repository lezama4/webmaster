import type { PublicEventProjection } from "@application/dto/PublicEventProjection";
import type { PublicEventProjectionQuery } from "@application/ports/PublicEventProjectionQuery";
import type { PrismaClientOrTx } from "./client";

/**
 * The ONLY adapter permitted to join Event -> Slot -> Proposal -> (Artist)
 * Profile (ADR D6, M6 pr2-review). Uses a Prisma `select` (never `include`)
 * so `location`/`message`/ids/email never leave Postgres, and builds the
 * returned `PublicEventProjection` as a FRESH object literal, field by
 * field — never a spread of the query result — so a future accidental
 * widening of the `select` cannot leak an extra property through this
 * boundary at runtime (defense-in-depth beyond the TypeScript type).
 */
export class PrismaPublicEventProjectionQuery
  implements PublicEventProjectionQuery
{
  constructor(private readonly client: PrismaClientOrTx) {}

  async listPublished(): Promise<readonly PublicEventProjection[]> {
    const rows = await this.client.event.findMany({
      where: { status: "PUBLISHED" },
      select: {
        title: true,
        slot: {
          select: {
            description: true,
            scheduledAt: true,
            durationMinutes: true,
          },
        },
        proposal: {
          select: {
            artistProfile: {
              select: { name: true },
            },
          },
        },
      },
    });

    return rows.map((row): PublicEventProjection => ({
      title: row.title,
      description: row.slot.description,
      scheduledAt: row.slot.scheduledAt,
      durationMinutes: row.slot.durationMinutes,
      artistName: row.proposal.artistProfile.name,
    }));
  }
}
