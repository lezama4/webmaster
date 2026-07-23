# Delta for Public Event Browsing

## ADDED Requirements

### Requirement: Widening the Directory to centreType Creates No New Correlation Path

Adding `centreType` to the public directory (see `public-hospital-directory`) MUST NOT let an anonymous visitor join it to the public Events surface to infer which centre hosted which Event. The public Events projection (`PublicEventProjection`, ADR D6) exposes **no location and no centre-identifying field of any kind** — this remains true after this change, so `centreType` has no field on the event side to join against. This is the event-to-centre half of the non-correlation invariant (ADR D10, re-assessed under D19); the centre-to-event half is specified in `public-hospital-directory`.

#### Scenario: Public Event surface still has no location or centre-identifying field

- GIVEN the public Events surface after this change ships
- WHEN the projected object's keys are inspected for any published Event
- THEN no key represents a location, a centre id/name/city/postalCode/coordinates, or a `type`/`centreType` value

#### Scenario: Hostile adapter cannot attach centreType or centre identity to a public Event

- GIVEN a fake port implementation that returns, per Event, a `centreType`, a centre `id`, `name`, `city`, `postalCode`, and coordinates in addition to the allow-listed Event fields
- WHEN the `listPublishedEvents` use case is invoked
- THEN the resulting projection for that Event MUST NOT contain any of those injected fields

#### Scenario: A lone centre of a rare type does not narrow any event

- GIVEN a city with exactly one ACTIVE `palliative_unit` centre and no other centre in that city
- WHEN an anonymous visitor fetches the public Events list
- THEN no Event field reveals a location or an originating centre, so the visitor cannot determine that any Event is connected to that palliative unit, or to that city at all

#### Scenario: Events from centres of different types remain indistinguishable by centre

- GIVEN two published Events originating from Slots at two active centres of different `centreType` values
- WHEN an anonymous visitor fetches both through the public Events list
- THEN no field in either response lets the visitor determine which centre hosted which Event, its `centreType`, or that they differ by centre at all

### Requirement: Both Non-Correlation Suites Are Re-Run, Not Merely Extended

The existing non-correlation test suites (`tests/unit/application/nonCorrelation.test.ts`, `e2e/non-correlation.spec.ts`) MUST be re-run against the widened directory and MUST pass unchanged in intent, so that any adapter which accidentally introduces a join between `centreType` and a Slot/Proposal/Event-derived field is caught.

#### Scenario: Non-correlation suites pass after centreType is added

- GIVEN `centreType` has been added to the public directory allow-list
- WHEN both non-correlation suites are executed
- THEN both pass, with `centreType` present only on the directory side and absent from every Event-side assertion
