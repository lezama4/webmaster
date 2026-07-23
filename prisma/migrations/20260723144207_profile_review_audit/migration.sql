-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVE', 'REJECT', 'DEACTIVATE');

-- CreateTable
CREATE TABLE "profile_reviews" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "adminAccountId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "basis" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profile_reviews_profileId_createdAt_idx" ON "profile_reviews"("profileId", "createdAt");

-- AddForeignKey
ALTER TABLE "profile_reviews" ADD CONSTRAINT "profile_reviews_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
