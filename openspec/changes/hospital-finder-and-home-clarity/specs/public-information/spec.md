# Public Information Specification

## Purpose

Governs presentation-only public content with no new data access: the home page's explanatory block and the `/quienes-somos` route. Together they answer, for a first-time anonymous visitor, what the platform is, who it serves, and what data stance it takes.

## Requirements

### Requirement: Home Displays an Explanatory Block Before Mission

The home page MUST display an explanatory block positioned between the Hero and Mission sections. It MUST state, in plain language: what the platform does (connects hospitals and artists to fill waiting hours with live culture), that it is free and non-profit, and the three-step flow (hospital publishes a Slot → Artist proposes → Event is published). It MUST link to `/quienes-somos` for more depth.

#### Scenario: Clarity block renders between Hero and Mission

- GIVEN an anonymous visitor opens the home page
- WHEN the page renders
- THEN the explanatory block appears after the Hero section and before the Mission section

#### Scenario: Clarity block links to /quienes-somos

- GIVEN the explanatory block is rendered
- WHEN the visitor inspects its content
- THEN it contains a link to `/quienes-somos`

### Requirement: /quienes-somos Covers Purpose, Roles, Flow, Validation, Data Stance, and Funding

The `/quienes-somos` route MUST be publicly reachable without authentication. It MUST present: purpose and social mission; the four roles (Admin, Hospital, Artist, Patient/Family); the full flow from Slot publication to Event; that Hospital and Artist profiles are validated by an Admin before they can act; what hospital data is published (name, city, postal code, coordinates) and what is deliberately not (street address, and no correlation between a hospital and its events); and why the platform is free and non-profit.

#### Scenario: Anonymous visitor reaches /quienes-somos without login

- GIVEN no authenticated session
- WHEN a visitor navigates to `/quienes-somos`
- THEN the page renders successfully, with all six content areas present (purpose, roles, flow, validation, data stance, funding)

#### Scenario: Content ownership does not duplicate /ayuda

- GIVEN `/ayuda` already owns the four-role step-by-step how-to content
- WHEN `/quienes-somos` is authored
- THEN it MUST cover purpose, governance, data stance, and funding rather than repeating `/ayuda`'s step-by-step copy
- (This scenario is verified by manual content review, not an automated test — no mechanical check can determine whether two prose blocks are "duplicative" content)

### Requirement: Accessibility of the Home Clarity Block and Mocked Map

The clarity block MUST use a heading level consistent with the surrounding document outline (no skipped heading levels). Each map pin MUST be reachable via keyboard in the page's natural tab order and MUST expose an accessible name via `aria-label` (or equivalent) identifying the hospital by name and city, so a screen reader announces meaningful information rather than a generic "button".

#### Scenario: Keyboard-only visitor reaches every pin

- GIVEN the mocked map renders N hospital pins
- WHEN a visitor navigates using only the Tab key
- THEN focus reaches all N pins in sequence, each visibly focus-indicated

#### Scenario: Screen reader announces pin identity

- GIVEN a map pin for a hospital named "Hospital San Juan" in "Bilbao"
- WHEN a screen reader reaches that pin
- THEN it announces an accessible name identifying the hospital, e.g. "Hospital San Juan, Bilbao", not merely "button"

#### Scenario: Clarity block heading level is not skipped

- GIVEN the Hero section's heading level and the Mission section's heading level
- WHEN the clarity block's heading is inspected in the rendered DOM
- THEN its level is consistent with a non-skipping document outline (e.g. does not jump from `h1` to `h4`)
