import type {
  OpenSlotListingItem,
  OpenSlotListingQuery,
} from "@application/ports/OpenSlotListingQuery";
import type { PrismaClientOrTx } from "./client";
import { toDomainAudience } from "./mappers";

/**
 * Artist-facing open-Slot listing adapter (N2/pr2a-N3). Joins Slot -> (owning
 * Hospital) Profile in ONE query using a Prisma `select` (never `include`)
 * so only `location`/`title`/`description`/schedule fields and the
 * Hospital's public `name` leave Postgres — no Account id/email. Builds the
 * returned `OpenSlotListingItem` as a FRESH object literal, field by field —
 * never a spread of the query result — mirroring
 * `PrismaPublicEventProjectionQuery`/`PrismaHospitalSlotBoardQuery`'s
 * discipline. Fails fast (rejects) if a Slot's owning Hospital Profile
 * relation is broken, rather than silently substituting a placeholder name —
 * `hospitalProfileId` is a required FK, so Prisma's `select` on the relation
 * only returns `null` when the underlying data is inconsistent.
 */
export class PrismaOpenSlotListingQuery implements OpenSlotListingQuery {
  constructor(private readonly client: PrismaClientOrTx) {}

  async listOpenUpcoming(now: Date): Promise<readonly OpenSlotListingItem[]> {
    const rows = await this.client.slot.findMany({
      where: { status: "OPEN", scheduledAt: { gt: now } },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        scheduledAt: true,
        durationMinutes: true,
        location: true,
        audience: true,
        hospitalProfile: {
          select: { name: true },
        },
      },
    });

    return rows.map((row): OpenSlotListingItem => {
      if (!row.hospitalProfile) {
        throw new Error(
          `Slot ${row.id} has a broken hospitalProfile relation`,
        );
      }

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        scheduledAt: row.scheduledAt,
        durationMinutes: row.durationMinutes,
        location: row.location,
        hospitalName: row.hospitalProfile.name,
        audience: toDomainAudience(row.audience),
      };
    });
  }
}
