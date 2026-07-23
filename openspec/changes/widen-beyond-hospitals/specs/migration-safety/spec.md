# Migration Safety Specification

## Purpose

Governs the non-destructive migration (ADR D17) that renames `HOSPITAL` → `CENTRE` on both `AccountRole` and `ProfileType`, adds the new `CentreType` enum/column, and backfills every existing row to `centreType: "hospital"`. Existing hospital rows MUST survive with zero data loss.

## Requirements

### Requirement: Existing HOSPITAL Rows Survive as Generic-Role Centres of Type hospital, Zero Data Loss

Every row whose role/profile-type was `HOSPITAL` before the migration MUST, after the migration, read as role/profile-type `CENTRE` with `centreType: "hospital"`, and MUST retain every other field (name, city, postalCode, addressLine, latitude, longitude, status, account credentials, and all foreign-key relations) unchanged. The migration MUST use `ALTER TYPE ... RENAME VALUE` (in-place label rename, same enum OID), not an add-new-value-then-backfill-then-drop sequence, so no row is rewritten or re-keyed.

#### Scenario: An existing hospital row reads as centre + centreType hospital after migration

- GIVEN a profile row that had `type: HOSPITAL` before the migration ran
- WHEN the migration completes and the row is queried
- THEN it reads `type: CENTRE` and `centreType: "hospital"`, with every other field byte-identical to its pre-migration value

#### Scenario: No row loses its slots or events

- GIVEN a pre-migration hospital profile with existing published Slots and Events derived from them
- WHEN the migration completes
- THEN every Slot and Event previously associated with that profile is still associated with it, in the same count, with no orphaned or deleted rows

#### Scenario: Account credentials and status are unaffected

- GIVEN a pre-migration hospital Account with `status: ACTIVE` and existing login credentials
- WHEN the migration completes
- THEN the Account authenticates with the same credentials, retains `status: ACTIVE`, and its role reads `centre`

#### Scenario: Artist rows are untouched

- GIVEN a pre-migration Artist profile (`type: ARTIST`)
- WHEN the migration completes
- THEN its `type` is unchanged and its `centreType` column is `NULL`

#### Scenario: Migration is provably safe against real Postgres before deploy

- GIVEN the seed dataset loaded into a real Postgres instance (not a mock)
- WHEN the hand-written migration is applied
- THEN it completes without error, row counts for `profiles`, `slots`, and `events` are unchanged before/after, and every backfilled `centreType` equals `"hospital"` for every row that was `HOSPITAL` pre-migration

### Requirement: The Down Migration Is Documented and Honest About Its Limit

A reverse migration path MUST exist and MUST be documented. It is only lossless while no non-`hospital` `centreType` row has been created; if one has, the down path MUST be documented as a semantic coarsening (that row's role reverts to the old `HOSPITAL` value and its distinguishing `centreType` is dropped), not silently hidden as risk-free.

#### Scenario: Down migration is clean when no new-kind centre exists

- GIVEN the up-migration has run and no `nursing_home`/`day_centre`/`day_hospital`/`occupational_centre`/`palliative_unit` row has been created
- WHEN the down migration is applied
- THEN every row returns to its original `HOSPITAL` state with no data loss

#### Scenario: Down migration's coarsening limit is documented, not hidden

- GIVEN a `palliative_unit` row was created after the up-migration
- WHEN the down migration's documentation is reviewed
- THEN it explicitly states that reverting will coarsen that row to `HOSPITAL` and drop its `centreType`, rather than presenting the down path as universally lossless
