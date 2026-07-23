# Delta for Migration Safety

## ADDED Requirements

### Requirement: The ProfileReview Migration Is Purely Additive and Touches No Existing Profile Row

The migration that introduces the `ProfileReview` table and the `ReviewDecision` enum MUST be additive only — it MUST add a new table and a new enum and a new back-relation on `Profile`, and MUST NOT alter, rewrite, or drop any existing column or row on `profiles` or any other pre-existing table.

#### Scenario: No existing Profile row is altered by the migration

- GIVEN a `profiles` row that existed before this migration ran, in any status (`pending`, `active`, `rejected`, `deactivated`)
- WHEN the migration completes and that row is queried
- THEN every one of its fields (name, city, status, account credentials, and all other pre-existing columns) is byte-identical to its pre-migration value

#### Scenario: The migration adds only new schema objects

- GIVEN the migration's generated SQL
- WHEN it is inspected
- THEN it contains only `CREATE TABLE`/`CREATE TYPE`/`ALTER TABLE ... ADD` statements for `ProfileReview`/`ReviewDecision`, and no `ALTER COLUMN`, `DROP`, or `UPDATE` against any pre-existing table

### Requirement: Existing Active, Rejected, and Deactivated Profiles Survive With Zero Review Rows and Read as "No Basis Recorded"

Every profile whose current `active`, `rejected`, or `deactivated` status was reached before this change shipped MUST have zero `ProfileReview` rows after the migration, and the admin-facing surface MUST render that absence as an explicit "no basis recorded (legacy)" label — never a fabricated or back-filled basis.

#### Scenario: A pre-existing active profile has zero review rows

- GIVEN a profile that was approved before this change shipped, now `status: active`
- WHEN its `ProfileReview` history is queried after the migration
- THEN it returns zero rows

#### Scenario: A pre-existing rejected profile has zero review rows

- GIVEN a profile that was rejected before this change shipped, now `status: rejected`
- WHEN its `ProfileReview` history is queried after the migration
- THEN it returns zero rows

#### Scenario: A pre-existing deactivated profile has zero review rows

- GIVEN a profile that was deactivated before this change shipped, now `status: deactivated`
- WHEN its `ProfileReview` history is queried after the migration
- THEN it returns zero rows

#### Scenario: A legacy profile with no review rows is labelled honestly, not fabricated

- GIVEN a profile with zero `ProfileReview` rows, in any post-migration status other than `pending`
- WHEN it is displayed on an authenticated admin surface that renders review history
- THEN it shows an explicit "no basis recorded (predates auditing)" label — it MUST NOT show an invented basis, an invented admin id, or any placeholder text presented as if it were a real recorded decision

### Requirement: Legacy Rows Are Never Back-Filled With an Invented Basis

No migration step, seed script, or application code path MUST write a synthetic, guessed, or placeholder `ProfileReview` row for a profile whose decision predates this change. An honest absence of review rows is the only correct representation of "this decision was made before the control existed."

#### Scenario: The migration itself inserts no ProfileReview rows for pre-existing profiles

- GIVEN the full set of `profiles` rows present immediately before the migration runs
- WHEN the migration completes
- THEN the `ProfileReview` table contains zero rows attributable to any of those pre-existing profiles

#### Scenario: No back-fill script or seed step invents a basis for a legacy profile

- GIVEN the project's migration and seed scripts as shipped with this change
- WHEN they are inspected
- THEN none of them contains logic that constructs a `ProfileReview` row for a profile that had no such row before the migration
