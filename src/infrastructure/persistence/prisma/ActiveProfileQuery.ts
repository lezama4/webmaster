import type { ActiveProfileView } from "@application/dto/ActiveProfileView";
import type { ActiveProfileQuery } from "@application/ports/ActiveProfileQuery";
import { toDomainCentreType } from "./mappers";
import type { PrismaClientOrTx } from "./client";

const PROFILE_TYPE_TO_DOMAIN = {
  CENTRE: "centre",
  ARTIST: "artist",
} as const;

/**
 * The Admin active-profile listing adapter (auditable-profile-approval,
 * PR4/5.6). Uses a Prisma `select` (never `include`) so `accountId`/email/
 * password hash never leave Postgres, and builds the returned
 * `ActiveProfileView` as a FRESH object literal, field by field — never a
 * spread of the query result. Mirrors `PrismaPendingProfileQuery`.
 */
export class PrismaActiveProfileQuery implements ActiveProfileQuery {
  constructor(private readonly client: PrismaClientOrTx) {}

  async listActive(): Promise<readonly ActiveProfileView[]> {
    const rows = await this.client.profile.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        type: true,
        centreType: true,
        name: true,
      },
    });

    const views = rows.map((row): ActiveProfileView => ({
      profileId: row.id,
      type: PROFILE_TYPE_TO_DOMAIN[row.type],
      ...(row.centreType !== null && row.centreType !== undefined
        ? { centreType: toDomainCentreType(row.centreType) }
        : {}),
      displayName: row.name,
    }));

    return views.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
}
