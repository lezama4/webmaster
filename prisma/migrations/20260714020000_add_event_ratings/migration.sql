-- Adds the `ratings` table (Phase 3, Block 2 — real event ratings).
--
-- Any registered Account may rate a PUBLISHED Event 1-5 stars; one Rating
-- per (eventId, raterAccountId), enforced by the unique index below and
-- relied on by `PrismaRatingRepository.upsert` (a single
-- INSERT ... ON CONFLICT DO UPDATE via Prisma's `upsert`). Both foreign
-- keys cascade on delete: removing an Event or an Account removes its
-- Ratings with it — a Rating has no meaning once its Event or its rater's
-- Account is gone, and there is no soft-delete/audit requirement for this
-- table (unlike Session/LoginAttemptWindow, which are security-relevant).
--
-- Individual ratings and rater identity stay PRIVATE (ADR D6 extension) —
-- this migration only creates the storage; the public projection surfaces
-- solely the aggregate average + count, computed in
-- `PrismaPublicEventProjectionQuery`, never a row from this table directly.

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "raterAccountId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ratings_eventId_raterAccountId_key" ON "ratings"("eventId", "raterAccountId");

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_raterAccountId_fkey" FOREIGN KEY ("raterAccountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
