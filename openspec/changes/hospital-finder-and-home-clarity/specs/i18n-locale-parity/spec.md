# i18n Locale Parity Specification

## Purpose

Governs cross-locale content parity for `messages/es.json`, `messages/eu.json`, and `messages/en.json`, converting today's convention-only parity into a mechanically enforced guard (ADR D13). Recommended scope is repository-wide (all namespaces), not limited to the new ones introduced by this change.

## Requirements

### Requirement: Locale Files Share an Identical Flattened Key Set

The flattened set of translation keys (dot-path, including nested namespaces) across `messages/es.json`, `messages/eu.json`, and `messages/en.json` MUST be identical. A key present in one file and absent, or differently nested, in another MUST fail an automated check. The check MUST be bidirectional: it MUST catch both a key missing from a locale and a key present only in one locale that the others lack.

#### Scenario: All three locale files are in parity

- GIVEN `messages/es.json`, `messages/eu.json`, and `messages/en.json` as currently maintained
- WHEN the flattened key sets of the three files are compared
- THEN all three sets are equal — no diff

#### Scenario: A key is missing from one locale

- GIVEN a key exists in `messages/es.json` under `Home.clarityBlock.title`
- WHEN that same dot-path is absent from `messages/eu.json` or `messages/en.json`
- THEN the parity check MUST fail and MUST name the missing key and the locale(s) missing it

#### Scenario: A key exists only in one locale (over-addition)

- GIVEN a key exists in `messages/eu.json` under `Home.clarityBlock.extra` with no corresponding key in `messages/es.json` or `messages/en.json`
- WHEN the parity check runs
- THEN it MUST fail, since parity requires the sets to be equal, not merely `es`/`en` being a superset of `eu`
