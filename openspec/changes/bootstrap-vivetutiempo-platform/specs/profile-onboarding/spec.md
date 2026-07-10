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

A profile in `pending` or `rejected` state MUST NOT publish Slots or submit Proposals.

#### Scenario: Pending Hospital attempts to publish a Slot

- GIVEN a Hospital profile in `pending` state
- WHEN that Hospital attempts to publish a Slot
- THEN the action MUST be denied

#### Scenario: Rejected Artist attempts to submit a Proposal

- GIVEN an Artist profile in `rejected` state
- WHEN that Artist attempts to submit a Proposal
- THEN the action MUST be denied

### Requirement: Rejected Profile May Re-Register

A `rejected` Hospital or Artist SHOULD be able to submit a new registration, re-entering `pending` review.

#### Scenario: Rejected Artist re-registers

- GIVEN an Artist profile in `rejected` state
- WHEN the Artist submits a new registration
- THEN a profile MUST re-enter `pending` state for Admin review
