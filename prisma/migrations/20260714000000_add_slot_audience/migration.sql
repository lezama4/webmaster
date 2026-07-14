-- Adds the hospital-set "audience" (age band) to Slot (Phase 1 — audience).
--
-- Applied strictly AFTER the base migration and the partial-unique-index
-- migration — it only adds a new enum type and a new, defaulted, NOT NULL
-- column on the existing "slots" table, so it is safe to run against a
-- database that already has rows.

-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('ALL_AGES', 'EARLY_CHILDHOOD', 'CHILDREN', 'TEENS', 'ADULTS');

-- AlterTable
ALTER TABLE "slots" ADD COLUMN "audience" "Audience" NOT NULL DEFAULT 'ALL_AGES';
