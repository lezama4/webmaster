# Delta for i18n Locale Parity

## MODIFIED Requirements

### Requirement: Locale Files Share an Identical Flattened Key Set

The flattened set of translation keys (dot-path, including nested namespaces) across `messages/es.json`, `messages/eu.json`, and `messages/en.json` MUST be identical, including all keys this change adds (`CentreType.*` labels, `Register.centreType.*`, `AdminProfiles.centreType.*`, generalised `Finder`/`Home`/`About`/`Help`/`Layout` keys). A key present in one file and absent, or differently nested, in another MUST fail an automated check, bidirectionally.
(Previously: did not account for the `CentreType`/`Register.centreType`/`AdminProfiles.centreType` namespaces, which did not exist.)

#### Scenario: All three locale files are in parity after the vocabulary rewrite

- GIVEN `messages/es.json`, `messages/eu.json`, and `messages/en.json` as shipped by this change
- WHEN the flattened key sets of the three files are compared
- THEN all three sets are equal — no diff, including the new `CentreType`/`Register.centreType`/`AdminProfiles.centreType` keys

#### Scenario: A new CentreType key missing from one locale fails the check

- GIVEN `CentreType.palliative_unit` exists in `messages/es.json`
- WHEN that same dot-path is absent from `messages/eu.json` or `messages/en.json`
- THEN the parity check MUST fail and MUST name the missing key and the locale(s) missing it

## ADDED Requirements

### Requirement: All Six centreType Labels Exist in All Three Locales

For each of the six `centreType` values, a display label MUST exist under a stable key (e.g. `CentreType.<value>`) in `es`, `eu`, and `en`. This is checked by the same automated parity mechanism as the rest of the key set, plus a targeted assertion that exactly six `CentreType.*` keys exist.

#### Scenario: Exactly six CentreType labels exist per locale

- GIVEN `messages/es.json`, `messages/eu.json`, `messages/en.json`
- WHEN the `CentreType` namespace is inspected in each
- THEN each locale has exactly six keys, one per `centreType` value (`hospital`, `nursing_home`, `day_centre`, `day_hospital`, `occupational_centre`, `palliative_unit`), with no extra or missing entry

### Requirement: Basque Vocabulary Quality Is a Blocking Open Gate, Not a Passing Assertion

Every `eu` string touched by this change (the `CentreType` labels, the type-specific person terms, and every rewritten narrative key) is DRAFT and MUST be reviewed and signed off by the assigned native Basque speaker before merge. The automated locale-parity check (structure/key-set/ICU-placeholder parity) MUST NOT be reported, cited, or relied upon as evidence of Basque translation quality — it verifies structure only.

#### Scenario (manual gate, not automated): Basque copy is reviewed before merge

- GIVEN the `eu` strings this change introduces or rewrites
- WHEN the change is proposed for merge
- THEN a record exists that the assigned native Basque speaker reviewed and signed off on those strings
- AND this record is separate from, and MUST NOT be conflated with, a passing automated locale-parity run

#### Scenario: A passing parity check does not imply Basque quality sign-off

- GIVEN the automated locale-parity suite passes for `eu` (key sets and ICU placeholders match `es`/`en`)
- WHEN this result is reported
- THEN it MUST be reported as "structural parity: pass, translation quality: pending native review" — never as "Basque copy is done"
