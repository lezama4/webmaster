# `openspec/` — planning artefacts, and what is still authoritative

This directory holds the Spec-Driven Development record for the project: one
folder per change under `changes/`, each with its proposal, design, delta specs
and task list.

## These are historical records, not the current contract

Each folder describes **what was proposed, decided and specified at the time
that change was made**. They are deliberately **not rewritten** when a later
change supersedes them — rewriting them would erase the reasoning trail, which
is the main thing they exist to preserve.

So a statement in `changes/**` may be accurate for its own moment and no longer
describe the shipped system. Where that has happened, the affected requirement
or paragraph carries an explicit **SUPERSEDED** / **Historical** note pointing
at the current position. If you are auditing behaviour, do not read these
folders as the specification of today's system.

## Where the current truth lives

| Question | Authoritative source |
| --- | --- |
| What the system does with security- and privacy-relevant data | [`docs/security-threat-model.md`](../docs/security-threat-model.md) |
| What is actually enforced | The test suites — unit (`tests/unit/`), Postgres integration (`tests/integration/`) and Playwright (`e2e/`), all executed in CI |
| Delivery status and open findings | [`docs/tfm-readiness-report.md`](../docs/tfm-readiness-report.md) |
| How to run it | [`README.md`](../README.md) |

The **executable** guards are the strongest of these: an allow-list written in
a doc can drift, whereas `tests/unit/application/nonCorrelation.test.ts`,
`e2e/non-correlation.spec.ts` and the compile-time forbidden-key guard in
`src/application/dto/PublicHospitalProjection.ts` fail the build when the public
surfaces widen.

## Known supersessions

- **ADR D10 (cross-surface non-correlation) was revised twice, on purpose.**
  1. `events-show-centre` — a public event now names its hosting centre
     (public name + city), so a family can find events at their relative's
     centre.
  2. `centre-event-counts` — a centre card in the public directory shows an
     aggregate count of its published, still-upcoming events and links to its
     own filtered events list. The remaining half of D10 was retired because it
     no longer protected anything: the same number was already obtainable in
     two clicks from `/events?centre=<name>`.

  The privacy line that replaced it, and which the guards enforce: **the
  institution and its public activity level are public; the individual and the
  exact place are not** — the Slot's ward/room `location`, the street address,
  event titles and dates on the directory surface, proposals, emails and every
  internal id stay forbidden.

- `openspec/specs/` is empty: no change has been archived into a consolidated
  living spec. That is a known gap in the process, recorded here rather than
  implied by an empty directory.
