import type { Rating } from "@domain/rating/Rating";
import type {
  RatingAggregate,
  RatingRepository,
} from "@application/ports/RatingRepository";
import type { PrismaClientOrTx } from "./client";
import { toDomainRating } from "./mappers";

/**
 * Prisma adapter for `RatingRepository` (Phase 3, Block 2). `upsert` relies
 * on the `@@unique([eventId, raterAccountId])` constraint (migration
 * `20260714020000_add_event_ratings`) for a single atomic
 * INSERT ... ON CONFLICT DO UPDATE — no locking unit-of-work needed (see
 * the port's docstring). `aggregateForEvent` uses Prisma's `aggregate` (a
 * single SQL `AVG`/`COUNT`), never fetches individual rows, so no rater's
 * identity or individual Rating ever passes through this method.
 */
export class PrismaRatingRepository implements RatingRepository {
  constructor(private readonly client: PrismaClientOrTx) {}

  async findByEventAndRater(
    eventId: string,
    raterAccountId: string,
  ): Promise<Rating | null> {
    const row = await this.client.rating.findUnique({
      where: { eventId_raterAccountId: { eventId, raterAccountId } },
    });
    return row ? toDomainRating(row) : null;
  }

  async upsert(rating: Rating): Promise<void> {
    await this.client.rating.upsert({
      where: {
        eventId_raterAccountId: {
          eventId: rating.eventId,
          raterAccountId: rating.raterAccountId,
        },
      },
      create: {
        id: rating.id,
        eventId: rating.eventId,
        raterAccountId: rating.raterAccountId,
        stars: rating.stars,
      },
      update: {
        stars: rating.stars,
      },
    });
  }

  async listByRater(raterAccountId: string): Promise<readonly Rating[]> {
    const rows = await this.client.rating.findMany({
      where: { raterAccountId },
    });
    return rows.map(toDomainRating);
  }

  async aggregateForEvent(eventId: string): Promise<RatingAggregate> {
    const result = await this.client.rating.aggregate({
      where: { eventId },
      _avg: { stars: true },
      _count: { stars: true },
    });
    const ratingCount = result._count.stars;
    const averageStars =
      ratingCount === 0 || result._avg.stars === null
        ? null
        : Math.round(result._avg.stars * 10) / 10;
    return { averageStars, ratingCount };
  }
}
