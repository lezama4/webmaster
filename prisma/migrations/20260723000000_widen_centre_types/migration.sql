-- Widen beyond hospitals (ADR D16/D17, `widen-beyond-hospitals`).
--
-- HAND-WRITTEN, not Prisma-generated: Prisma's declarative diff does NOT
-- infer `RENAME VALUE` — editing `HOSPITAL` -> `CENTRE` in schema.prisma and
-- running `prisma migrate dev` would generate a destructive DROP-and-recreate
-- of the enum, which would fail or orphan every existing row. This migration
-- must be applied exactly as written below.
--
-- Order matters:
--   1) RENAME VALUE on both enums that carry the role/kind conflation
--      (AccountRole, ProfileType) — renames the label IN PLACE (the enum
--      OID is unchanged), so every existing row reads as CENTRE with NO row
--      rewrite and zero data loss, in one cheap statement per enum.
--   2) CREATE the new, independent CentreType enum (the six kinds).
--   3) ADD the nullable `profiles.centreType` column.
--   4) BACKFILL: every existing profile of the (now renamed) CENTRE type
--      genuinely IS a hospital — this is a fact about the pre-migration
--      data (the product only had hospitals before this change), not user
--      input. Artists keep `centreType` NULL.
--
-- Why RENAME, not add-new-value + backfill + drop: `ALTER TYPE ... ADD
-- VALUE` cannot be used in the same transaction that references the new
-- value (the classic "unsafe use of new value" restriction), which would
-- force a multi-migration dance and a later `DROP VALUE` Postgres does not
-- even support cleanly. RENAME sidesteps all of it and is transaction-safe.

ALTER TYPE "AccountRole" RENAME VALUE 'HOSPITAL' TO 'CENTRE';
ALTER TYPE "ProfileType" RENAME VALUE 'HOSPITAL' TO 'CENTRE';

CREATE TYPE "CentreType" AS ENUM (
  'HOSPITAL','NURSING_HOME','DAY_CENTRE','DAY_HOSPITAL',
  'OCCUPATIONAL_CENTRE','PALLIATIVE_UNIT'
);

ALTER TABLE "profiles" ADD COLUMN "centreType" "CentreType";

-- Backfill: every existing profile of the (now renamed) CENTRE type
-- genuinely IS a hospital. Artists keep NULL. Not user input — a fact
-- about the data.
UPDATE "profiles" SET "centreType" = 'HOSPITAL' WHERE "type" = 'CENTRE';

-- Down path (documented here, NOT as a separate down-migration file —
-- Prisma does not run one automatically). Reverse order:
--   UPDATE "profiles" SET "centreType" = NULL;
--   ALTER TABLE "profiles" DROP COLUMN "centreType";
--   DROP TYPE "CentreType";
--   ALTER TYPE "AccountRole" RENAME VALUE 'CENTRE' TO 'HOSPITAL';
--   ALTER TYPE "ProfileType" RENAME VALUE 'CENTRE' TO 'HOSPITAL';
--
-- This down path is LOSSLESS ONLY while no non-hospital `centreType` row
-- exists. If a `nursing_home`/`palliative_unit`/etc. row was created after
-- the up-migration, the down-migration renames its role back to `HOSPITAL`
-- and DROPS its category along with the column — a documented, honest
-- semantic coarsening, not a crash and not hidden. Acceptable for a demo;
-- verify no non-hospital centre exists before ever running the down path
-- for real.
