-- Adds the PUBLIC hospital location fields to Profile (Phase 2 — hospital
-- public location).
--
-- All five columns are NULLABLE and carry no default: a hospital may
-- register without a location and add it later, and existing rows (any
-- Profile already in the table, hospital or artist) are unaffected — this
-- is a pure additive, backward-compatible change, safe to run against a
-- database that already has rows.
--
-- NOT related to Slot.location (the ward/room), which stays PRIVATE and is
-- never exposed through the public event projection (ADR D6). This is a
-- separate, public surface on Profile only.

-- AlterTable
ALTER TABLE "profiles"
  ADD COLUMN "city" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "addressLine" TEXT,
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION;
