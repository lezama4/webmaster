# Slot & Proposal Coordination Specification

## Purpose

Governs Hospital Slot publishing, competing Artist Proposals, Hospital-owner approval authority, and the auto-reject/Event-creation invariant that resolves a Slot.

## Requirements

### Requirement: Active Hospital Publishes a Slot

An `active` Hospital MUST be able to publish a Slot. A newly published Slot MUST start in `open` state, owned by the publishing Hospital.

#### Scenario: Active Hospital publishes a Slot

- GIVEN an `active` Hospital profile
- WHEN the Hospital publishes a Slot
- THEN the Slot is created in `open` state, owned by that Hospital

### Requirement: Active Artist Submits a Proposal Against an Open Slot

An `active` Artist MUST be able to submit a Proposal against an `open` Slot. A Slot MAY receive multiple competing Proposals.

#### Scenario: Artist submits a Proposal for an open Slot

- GIVEN an `open` Slot and an `active` Artist profile
- WHEN the Artist submits a Proposal for that Slot
- THEN the Proposal is created in `submitted` state

#### Scenario: Second Artist submits a competing Proposal

- GIVEN an `open` Slot with one `submitted` Proposal
- WHEN a different `active` Artist submits a Proposal for the same Slot
- THEN both Proposals coexist in `submitted` state

### Requirement: Only the Owning Hospital Approves or Rejects Proposals

Only the Hospital that owns a Slot MUST be able to approve or reject Proposals submitted against that Slot. Admin MUST NOT approve or reject Proposals.

#### Scenario: Owning Hospital approves a Proposal

- GIVEN a Slot owned by Hospital A with a `submitted` Proposal
- WHEN Hospital A approves that Proposal
- THEN the Proposal transitions to `accepted`

#### Scenario: Non-owning Hospital attempts to act on a Slot it does not own

- GIVEN a Slot owned by Hospital A
- WHEN Hospital B attempts to approve or reject a Proposal on that Slot
- THEN the action MUST be denied

### Requirement: Accepting a Proposal Auto-Rejects Competitors and Publishes an Event

Accepting one Proposal for a Slot MUST automatically reject every other `submitted` Proposal for that same Slot, transition the Slot to `filled`, and create and publish an Event from the accepted Proposal.

#### Scenario: Accepting one Proposal rejects the rest and publishes an Event

- GIVEN a Slot with Proposals P1 and P2, both `submitted`
- WHEN the owning Hospital accepts P1
- THEN P1 transitions to `accepted`
- AND P2 automatically transitions to `rejected`
- AND the Slot transitions to `filled`
- AND an Event is created and published from P1

### Requirement: Approval Is Denied on a Non-Open Slot

The system MUST deny an approval or rejection attempt targeting a Slot that is already `filled` or `closed`.

#### Scenario: Approving a Proposal on an already-filled Slot

- GIVEN a Slot in `filled` state
- WHEN the owning Hospital attempts to approve a Proposal on it
- THEN the action MUST be denied

### Requirement: Withdrawing a Slot Resolves Outstanding Proposals

Closing or withdrawing a Slot that still has `submitted` Proposals MUST move the Slot out of `open` state and those Proposals MUST NOT remain actionable.

#### Scenario: Hospital withdraws a Slot with outstanding Proposals

- GIVEN an `open` Slot with `submitted` Proposals
- WHEN the owning Hospital closes or withdraws the Slot
- THEN the Slot transitions to `closed`
- AND the outstanding Proposals MUST NOT remain actionable

#### Scenario: No Proposals yet on a Slot

- GIVEN an `open` Slot with no Proposals
- WHEN the owning Hospital views the Slot
- THEN the system MUST show an empty state, not an error
