import type { PendingProfileView } from "@application/dto/PendingProfileView";
import type { PendingProfileQuery } from "@application/ports/PendingProfileQuery";
import { toDomainCentreType } from "./mappers";
import type { PrismaClientOrTx } from "./client";

const PROFILE_TYPE_TO_DOMAIN = {
  CENTRE: "centre",
  ARTIST: "artist",
} as const;

/**
 * The Admin pending-profile queue adapter (5.3/5.12). Uses a Prisma
 * `select` (never `include`) so `accountId`/email/password hash never leave
 * Postgres, and builds the returned `PendingProfileView` as a FRESH object
 * literal, field by field — never a spread of the query result.
 *
 * `requestedAt` is `reviewRequestedAt` when set (a re-registration, M2) or
 * `createdAt` otherwise (a first-time submission) — Prisma's `orderBy`
 * cannot express that coalesce directly, so the adapter sorts in memory
 * after computing it. The Admin queue is expected to stay small; this is
 * not a hot path.
 */
export class PrismaPendingProfileQuery implements PendingProfileQuery {
  constructor(private readonly client: PrismaClientOrTx) {}

  async listPending(): Promise<readonly PendingProfileView[]> {
    const rows = await this.client.profile.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        type: true,
        centreType: true,
        name: true,
        createdAt: true,
        reviewRequestedAt: true,
      },
    });

    const views = rows.map((row): PendingProfileView => ({
      profileId: row.id,
      type: PROFILE_TYPE_TO_DOMAIN[row.type],
      ...(row.centreType !== null && row.centreType !== undefined
        ? { centreType: toDomainCentreType(row.centreType) }
        : {}),
      displayName: row.name,
      requestedAt: row.reviewRequestedAt ?? row.createdAt,
    }));

    return views.sort(
      (a, b) => a.requestedAt.getTime() - b.requestedAt.getTime(),
    );
  }
}
