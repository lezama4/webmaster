# Delta for Public Event Browsing

## ADDED Requirements

### Requirement: Public Events Surface Contains No Hospital-Identifying Data

The public, unauthenticated Events projection MUST NOT gain any hospital-identifying field, directly or by proxy — no hospital id, name, city, postal code, or coordinates. This is the event-to-hospital half of the non-correlation invariant (ADR D10); the hospital-to-event half is specified in `public-hospital-directory`. Neither the hospital directory allow-list nor the event allow-list alone satisfies the invariant — it is a relation between the two surfaces and requires its own explicit test in each direction.

#### Scenario: Hostile adapter cannot attach hospital identity to a public Event

- GIVEN a fake port implementation that returns, per Event, a hospital `id`, `name`, `city`, `postalCode`, and coordinates in addition to the allow-listed Event fields
- WHEN the `listPublishedEvents` use case is invoked
- THEN the resulting projection MUST NOT contain any of those hospital-identifying fields

#### Scenario: Events at different hospitals are not distinguishable by hospital

- GIVEN two published Events originating from Slots at two different active Hospitals
- WHEN an anonymous visitor fetches both through the public Events list
- THEN no field in either response lets the visitor determine which hospital hosted which Event, nor infer they differ by hospital at all
