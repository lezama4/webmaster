# Delta for Public Information

## MODIFIED Requirements

### Requirement: /quienes-somos Covers Purpose, Roles, Flow, Validation, Data Stance, and Funding

The `/quienes-somos` route MUST be publicly reachable without authentication. It MUST present: purpose and social mission using relational phrasing that does not presuppose a hospital ward (ADR D20); the four roles (Admin, **Centre** — described generically, covering all six kinds, not "Hospital" — Artist, Patient/Family); the full flow from Slot publication to Event; that Centre and Artist profiles are validated by an Admin before they can act; what centre data is published (name, city, postal code, coordinates, **centreType**) and what is deliberately not (street address, the internal role field, and no correlation between a centre and its events); and why the platform is free and non-profit.
(Previously: named the role "Hospital" explicitly and described "what hospital data is published" without `centreType`.)

#### Scenario: Anonymous visitor reaches /quienes-somos without login

- GIVEN no authenticated session
- WHEN a visitor navigates to `/quienes-somos`
- THEN the page renders successfully, with all six content areas present (purpose, roles, flow, validation, data stance, funding)

#### Scenario: The generic role is named, not "Hospital"

- GIVEN the roles section of `/quienes-somos`
- WHEN its copy is inspected
- THEN it names the generic centre role and does not present "Hospital" as the only kind of participating organisation

#### Scenario: Data stance mentions centreType as published

- GIVEN the data-stance section of `/quienes-somos`
- WHEN its copy is inspected
- THEN it states that a centre's `centreType` (kind) is public, alongside name/city/postal code/coordinates, and that street address and cross-surface correlation with events are not

## ADDED Requirements

### Requirement: Cross-Type Narrative Copy Reads Correctly for Any of the Six Centre Types

Narrative, structural copy that does not know the concrete `centreType` — `Home.mission`, `Home.trust`, `About.purpose`, `Help.howItWorks`, `Layout.footer` — MUST use relational phrasing ("people whose circumstances keep them from going to culture") rather than hospital-specific premises ("estancias hospitalarias", "cama del hospital"), per ADR D20. This requirement is checked by **manual content review**, not an automated test — no mechanical check can determine whether prose "reads correctly" for a residencia or a centro de día.

#### Scenario (manual review): Home mission reads correctly for a residencia

- GIVEN `Home.mission`, `Home.trust`, and `About.purpose` as shipped
- WHEN a reviewer reads them from the premise of a nursing-home resident or a day-centre participant, instead of a hospital patient
- THEN no sentence presupposes a hospital ward, a bed, or "estancia hospitalaria" as the only setting
- (Manual review only — record pass/fail in the review checklist, not in an automated suite)

#### Scenario (manual review): Help and footer copy do not assume "paciente" as the only person served

- GIVEN `Help.howItWorks`, `Help.steps.*`, and `Layout.footer.description` as shipped
- WHEN a reviewer checks them against all six centre types
- THEN the copy either uses relational phrasing or, where the UI already knows the type, the type-specific correct term — never "paciente" as an assumed universal

### Requirement: The Finder Title No Longer Presupposes a Hospital

The `/encuentra-tu-momento` page's visible title/nav copy MUST refer to centres generically, not "hospital". The route slug `/encuentra-tu-momento` MUST NOT change.

#### Scenario: Finder title is generic

- GIVEN the `/encuentra-tu-momento` page as shipped
- WHEN its title/nav copy is inspected
- THEN it does not read "Encuentra tu hospital" or otherwise imply hospitals are the only listed kind

#### Scenario: The route slug is unchanged

- GIVEN existing shared/Open-Graph links pointing at `/encuentra-tu-momento`
- WHEN this change ships
- THEN the route path is still `/encuentra-tu-momento`, and those links continue to resolve
