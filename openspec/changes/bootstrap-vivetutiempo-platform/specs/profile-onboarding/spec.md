# Profile Onboarding Specification

## Purpose

Governs how Hospital and Artist actors self-register and how an Admin validates their profiles before they may act on the platform.

## Requirements

### Requirement: Self-Registration Creates a Pending Profile

The system MUST allow Hospital and Artist actors to self-register. A new registration MUST create a profile in `pending` state that cannot yet perform role actions.

#### Scenario: Hospital self-registers

- GIVEN no existing profile for this Hospital
- WHEN the Hospital submits a registration
- THEN a Hospital profile is created in `pending` state
- AND it MUST NOT be able to publish Slots yet

#### Scenario: Artist self-registers

- GIVEN no existing profile for this Artist
- WHEN the Artist submits a registration
- THEN an Artist profile is created in `pending` state
- AND it MUST NOT be able to submit Proposals yet

### Requirement: Only Admin Validates Pending Profiles

Only the Admin role MUST be able to transition a `pending` profile to `active` or `rejected`.

#### Scenario: Admin activates a pending profile

- GIVEN a Hospital or Artist profile in `pending` state
- WHEN the Admin approves the profile
- THEN the profile transitions to `active`
- AND the actor may now perform its role actions

#### Scenario: Admin rejects a pending profile

- GIVEN a Hospital or Artist profile in `pending` state
- WHEN the Admin rejects the profile
- THEN the profile transitions to `rejected`

#### Scenario: No pending profiles to review

- GIVEN no profiles are in `pending` state
- WHEN the Admin opens the validation queue
- THEN the system MUST show an empty state, not an error

### Requirement: Non-Active Profiles Are Blocked From Acting

A profile in `pending`, `rejected`, or `deactivated` state MUST NOT publish Slots or submit Proposals.

#### Scenario: Pending Hospital attempts to publish a Slot

- GIVEN a Hospital profile in `pending` state
- WHEN that Hospital attempts to publish a Slot
- THEN the action MUST be denied

#### Scenario: Rejected Artist attempts to submit a Proposal

- GIVEN an Artist profile in `rejected` state
- WHEN that Artist attempts to submit a Proposal
- THEN the action MUST be denied

#### Scenario: Deactivated Hospital attempts to publish a Slot

- GIVEN a Hospital profile in `deactivated` state
- WHEN that Hospital attempts to publish a Slot
- THEN the action MUST be denied

#### Scenario: Profile is deactivated or rejected after the session was created

- GIVEN an Artist or Hospital with an existing, still-live session, established while the profile was `active`
- WHEN the Admin transitions that profile to `rejected` or `deactivated`, and the actor then attempts a role action using the pre-existing session
- THEN the action MUST be denied by the application layer, re-checking the profile's current status rather than trusting the session's original snapshot
- AND the actor's sessions MUST already have been invalidated by the Admin's transition (see "Admin Deactivates an Active Profile" and rejection handling below), so the request additionally fails at authentication

### Requirement: Rejected Profile May Re-Register Into the Same Profile

A `rejected` Hospital or Artist MUST be able to submit a new registration. Re-registration MUST reactivate the **same** Profile row (identified by its unique `accountId`) rather than creating a second Profile or a new Account, and MUST re-enter `pending` review, recorded as a new, auditable review request.

#### Scenario: Rejected Artist re-registers

- GIVEN an Artist profile in `rejected` state, with `accountId` `A1`
- WHEN the Artist (Account `A1`) submits a new registration
- THEN that same Profile transitions `rejected → pending`
- AND no second Profile is created for `accountId` `A1`
- AND the re-registration is recorded as a new review request (e.g. a fresh review timestamp), distinguishable from the original submission for Admin traceability

#### Scenario: Admin reviews a re-registered profile like any pending profile

- GIVEN a Profile that reactivated `rejected → pending` via re-registration
- WHEN the Admin opens the validation queue
- THEN that profile MUST appear alongside first-time `pending` profiles, reviewable the same way (approve → `active`, reject → `rejected`)

### Requirement: Admin Deactivates an Active Profile

The Admin MUST be able to transition an `active` Hospital or Artist profile to `deactivated`. Deactivation MUST immediately invalidate every live session belonging to that profile's Account.

#### Scenario: Admin deactivates an active Hospital

- GIVEN a Hospital profile in `active` state, with one or more live sessions for its Account
- WHEN the Admin deactivates that profile
- THEN the profile transitions to `deactivated`
- AND all live sessions for that Account are invalidated immediately (a subsequent request using any of those session cookies MUST be treated as unauthenticated)
- AND that Hospital MUST NOT be able to publish Slots or act on existing ones until reactivated by a decision outside this change's scope

#### Scenario: Only Admin may deactivate a profile

- GIVEN an `active` Hospital or Artist profile
- WHEN an actor other than Admin (including the profile owner itself) attempts to deactivate it
- THEN the action MUST be denied
