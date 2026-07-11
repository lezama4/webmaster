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

### Requirement: Slot Fields Satisfy Domain Invariants

A Slot MUST NOT be created with a `scheduledAt` in the past, a non-positive `durationMinutes`, or `title`/`description`/`location` text outside defined length bounds.

#### Scenario: Publishing a Slot with a past scheduledAt is rejected

- GIVEN an `active` Hospital profile
- WHEN the Hospital attempts to publish a Slot whose `scheduledAt` is in the past (relative to the current time)
- THEN the action MUST be denied with a domain validation error

#### Scenario: Publishing a Slot with non-positive duration is rejected

- GIVEN an `active` Hospital profile
- WHEN the Hospital attempts to publish a Slot with `durationMinutes` of zero or less
- THEN the action MUST be denied with a domain validation error

### Requirement: Only Active Artists List Open Slots

Only `active` Artists MUST be able to list open Slots. The listing MUST exclude Slots that are `filled`, `closed`, or whose `scheduledAt` has already passed.

#### Scenario: Active Artist lists open Slots

- GIVEN one `open` Slot with a future `scheduledAt`, one `filled` Slot, and one `open` Slot whose `scheduledAt` is now in the past
- WHEN an `active` Artist lists open Slots
- THEN only the first Slot MUST appear in the listing

#### Scenario: Non-Artist or inactive Artist cannot list open Slots

- GIVEN an Artist profile in `pending` state, or an actor of a different role
- WHEN that actor attempts to list open Slots
- THEN the action MUST be denied

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

### Requirement: An Artist May Not Hold Two Simultaneous Open Proposals for the Same Slot

An Artist MUST NOT have more than one `submitted` Proposal against the same Slot at the same time. A duplicate submission attempt by the same Artist, while an earlier Proposal from that Artist is still `submitted` against that Slot, MUST be denied as a conflict — never silently ignored, and never resulting in two simultaneously `submitted` Proposals from the same Artist for the same Slot.

#### Scenario: Same Artist submits two concurrent Proposals for the same Slot

- GIVEN an `open` Slot and an `active` Artist who already has one `submitted` Proposal against it
- WHEN that same Artist submits a second Proposal for the same Slot while the first is still `submitted`
- THEN the second submission MUST be denied as a conflict, and exactly one `submitted` Proposal from that Artist MUST exist for that Slot

### Requirement: Submission Cannot Race Past a Concurrent Approval or Close

A Proposal submission that races against a concurrent approval or close on the same Slot MUST NOT result in an actionable Proposal against a Slot that is no longer `open`. Submission and the Slot-resolving transitions (approve, close) MUST be coordinated so that whichever completes second observes the other's outcome.

#### Scenario: Submission loses a race against an in-flight approval

- GIVEN an `open` Slot with a `submitted` Proposal P1
- WHEN a Hospital's approval of P1 and a different Artist's submission of a new Proposal P2 are attempted concurrently, and the approval commits first (Slot becomes `filled`)
- THEN P2's submission MUST be denied (it MUST NOT be inserted as an actionable `submitted` Proposal against the now-`filled` Slot)

#### Scenario: Submission loses a race against an in-flight close

- GIVEN an `open` Slot with a `submitted` Proposal P1
- WHEN the owning Hospital's close of the Slot and a different Artist's submission of a new Proposal P2 are attempted concurrently, and the close commits first (Slot becomes `closed`)
- THEN P2's submission MUST be denied (it MUST NOT be inserted as an actionable `submitted` Proposal against the now-`closed` Slot)

### Requirement: Manual Rejection Is Coordinated With a Concurrent Approval or Close

A Hospital's manual rejection of a Proposal that races against a concurrent approval or close on the same Slot MUST NOT produce a contradictory outcome. Rejection and the other Slot-resolving transitions (approve, close) MUST be coordinated so that exactly one coherent result persists — never a Proposal that is both rejected and the one an approval accepted, and never a Slot left inconsistent with its Proposals' final states.

#### Scenario: Rejection races a concurrent approval on a different Proposal

- GIVEN an `open` Slot with Proposals P1 and P2, both `submitted`
- WHEN the owning Hospital's rejection of P2 and the owning Hospital's approval of P1 are attempted concurrently
- THEN exactly one coherent outcome MUST result — P1 `accepted` (auto-rejecting every other `submitted` Proposal, including P2) and the Slot `filled`, OR P2 explicitly `rejected` first followed by a fully-resolved approval of P1 — but never a response reporting success for both operations against contradictory final states

#### Scenario: Rejection races a concurrent close

- GIVEN an `open` Slot with a `submitted` Proposal P1
- WHEN the owning Hospital's rejection of P1 and the owning Hospital's close of the Slot are attempted concurrently
- THEN exactly one coherent outcome MUST result — P1 ends in `rejected` state and the Slot in `closed` state, with only one of the two requests treated as the operation that actually performed the transition (the other observes the already-terminal state and is denied)

### Requirement: Only the Owning Hospital Approves or Rejects Proposals

Only the Hospital that owns a Slot MUST be able to approve or reject Proposals submitted against that Slot. Admin MUST NOT approve or reject Proposals. Artist and Patient actors MUST NOT approve or reject Proposals. An approval or rejection request MUST target a Proposal that actually belongs to the Slot named in the request; a mismatch MUST be denied.

#### Scenario: Owning Hospital approves a Proposal

- GIVEN a Slot owned by Hospital A with a `submitted` Proposal
- WHEN Hospital A approves that Proposal
- THEN the Proposal transitions to `accepted`

#### Scenario: Non-owning Hospital attempts to act on a Slot it does not own

- GIVEN a Slot owned by Hospital A
- WHEN Hospital B attempts to approve or reject a Proposal on that Slot
- THEN the action MUST be denied

#### Scenario: Admin attempts to approve or reject a Proposal

- GIVEN a Slot owned by Hospital A with a `submitted` Proposal
- WHEN the Admin attempts to approve or reject that Proposal
- THEN the action MUST be denied — Admin governs profiles only, never Proposals

#### Scenario: Artist or Patient attempts a Hospital-only mutation

- GIVEN a Slot owned by Hospital A with a `submitted` Proposal
- WHEN an Artist or Patient actor attempts to approve, reject, or close that Slot
- THEN the action MUST be denied

#### Scenario: Proposal id does not belong to the Slot id in the request

- GIVEN Proposal P1 submitted against Slot S1, and an unrelated Slot S2 also owned by Hospital A
- WHEN Hospital A attempts to approve or reject P1 while addressing it through Slot S2 (e.g. a request naming S2's id with P1's id)
- THEN the action MUST be denied, regardless of Hospital A owning both Slots

#### Scenario: Acting on a Proposal already in a terminal state

- GIVEN a Proposal already in `accepted` or `rejected` state
- WHEN the owning Hospital attempts to approve or reject that same Proposal again
- THEN the action MUST be denied — a terminal Proposal state MUST NOT be re-transitioned

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

#### Scenario: Profile becomes rejected or deactivated between session creation and the mutation

- GIVEN a Hospital with a live session created while its profile was `active`
- WHEN the Admin transitions that Hospital's profile to `rejected` or `deactivated`, and the Hospital then attempts to approve, reject, publish, or close a Slot using the pre-existing session
- THEN the action MUST be denied by the application layer's live-status check, not merely by hiding the corresponding UI control

### Requirement: The Owning Hospital Closes/Withdraws a Slot, Cascading Rejection to Outstanding Proposals

The Hospital that owns an `open` Slot MUST be able to close (withdraw) it. Closing a Slot MUST transition it to `closed` and MUST explicitly and auditably transition every `submitted` Proposal against it to `rejected` in the same operation — no Proposal is left in `submitted` state against a non-open Slot. Only the owning Hospital may close its Slot; closing a Slot that is not `open` (already `filled` or `closed`) MUST be denied.

#### Scenario: Hospital closes a Slot with outstanding Proposals

- GIVEN an `open` Slot with `submitted` Proposals P1 and P2
- WHEN the owning Hospital closes the Slot
- THEN the Slot transitions to `closed`
- AND P1 and P2 both transition explicitly to `rejected`

#### Scenario: Hospital closes a Slot with no Proposals

- GIVEN an `open` Slot with no Proposals
- WHEN the owning Hospital closes the Slot
- THEN the Slot transitions to `closed`
- AND the system MUST show an empty state, not an error, for that Slot's (empty) Proposal list

#### Scenario: Non-owning Hospital attempts to close a Slot

- GIVEN an `open` Slot owned by Hospital A
- WHEN Hospital B attempts to close that Slot
- THEN the action MUST be denied

#### Scenario: Closing an already-filled or already-closed Slot is denied

- GIVEN a Slot in `filled` or `closed` state
- WHEN the owning Hospital attempts to close it
- THEN the action MUST be denied

#### Scenario: No Proposals yet on an open Slot

- GIVEN an `open` Slot with no Proposals
- WHEN the owning Hospital views the Slot
- THEN the system MUST show an empty state, not an error
