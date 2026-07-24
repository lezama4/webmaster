# Delta for Auditable Admin Decisions

## ADDED Requirements

### Requirement: Approve, Reject, and Deactivate Each Require and Record an Attributed Basis

Every admin decision on a Profile — approve (`pending → active`), reject (`pending → rejected`), and deactivate (`active → deactivated`) — MUST require a non-blank, bounded verification basis and MUST persist it as a `ProfileReview` record. The applicant-initiated `reactivateProfile` transition (`rejected → pending`, re-registration) MUST NOT require or record a basis — it is already traced by `reviewRequestedAt` and is not an admin decision (ADR D22). A status transition MUST NOT be obtainable without the corresponding review being produced in the same call.

#### Scenario: Approving requires a non-blank bounded basis

- GIVEN a PENDING profile and a non-blank basis string within the bound
- WHEN an Admin approves it
- THEN the profile becomes `status: active` AND a `ProfileReview` with `decision: approve` is produced in the same call, carrying the supplied basis

#### Scenario: Rejecting requires and records a basis

- GIVEN a PENDING profile and a non-blank basis string within the bound
- WHEN an Admin rejects it
- THEN the profile becomes `status: rejected` AND a `ProfileReview` with `decision: reject` is produced, carrying the supplied basis

#### Scenario: Deactivating requires and records a basis

- GIVEN an ACTIVE profile and a non-blank basis string within the bound
- WHEN an Admin deactivates it
- THEN the profile becomes `status: deactivated` AND a `ProfileReview` with `decision: deactivate` is produced, carrying the supplied basis

#### Scenario: Applicant re-registration does not require or record a basis

- GIVEN a REJECTED profile whose account holder re-registers (`reactivateProfile`)
- WHEN the transition to `pending` occurs
- THEN it succeeds with no basis argument and produces no `ProfileReview` row — only `reviewRequestedAt` is updated, because this is the applicant's action, not an admin decision

### Requirement: A Blank or Whitespace-Only Basis Is Denied at the Domain, Never Only the UI

The basis MUST be validated inside the domain transition function itself, before the status change is produced, so that no caller — the admin route, a future admin CLI, or a test — can bypass the check by skipping client-side validation. A blank or whitespace-only basis, and a basis exceeding `MAX_REVIEW_BASIS_LENGTH` (1000 characters, trimmed), MUST be rejected with a `DomainValidationError` and MUST leave the profile's status unchanged.

#### Scenario: A whitespace-only basis is denied and the status does not change

- GIVEN a PENDING profile and a basis consisting only of whitespace (e.g. `"   "`)
- WHEN an Admin attempts to approve it
- THEN a `DomainValidationError` is thrown, no `ProfileReview` is produced, and the profile's status remains `pending`

#### Scenario: A scripted request bypassing the UI is still denied

- GIVEN a direct call to the domain transition function with an empty basis, simulating a scripted `POST` that skips the UI's required-field check entirely
- WHEN the transition is invoked
- THEN it is rejected identically to the UI-mediated case — the domain, not the UI, is the authoritative gate

#### Scenario: A basis over the bounded maximum length is rejected

- GIVEN a basis string whose trimmed length exceeds `MAX_REVIEW_BASIS_LENGTH`
- WHEN any of the three admin transitions is invoked with it
- THEN it is rejected with a `DomainValidationError` before any status change

#### Scenario: The basis is trimmed once, validated trimmed, and stored trimmed

- GIVEN a basis string with leading and trailing whitespace around non-blank content
- WHEN an admin transition is invoked with it
- THEN the stored `ProfileReview.basis` is the trimmed value, and validation is performed against that same trimmed value (never a re-read or a second trim)

### Requirement: The Acting Admin's Identity Is Sourced From the Live Session, Never From Client Input

The `adminAccountId` recorded on a `ProfileReview` MUST be the resolved, live-session `Actor.accountId` of the admin performing the action. It MUST NOT be read from the request body, a query parameter, or any other client-supplied value, so that a spoofed admin identity has no effect.

#### Scenario: The recorded admin id is the authenticated caller's session identity

- GIVEN an authenticated admin session with account id `A1`
- WHEN that admin approves, rejects, or deactivates a profile
- THEN the resulting `ProfileReview.adminAccountId` equals `A1`, sourced from the resolved session, not from any request field

#### Scenario: A client-supplied admin id in the request body is ignored

- GIVEN an authenticated admin session with account id `A1`, and a request body that additionally supplies an unrelated `adminAccountId` or `actorId` value
- WHEN the request is processed
- THEN the recorded `ProfileReview.adminAccountId` is `A1` — the client-supplied value has no effect on the persisted record

### Requirement: The Review Record Is Append-Only and Preserves the Full Decision History

`ProfileReview` rows MUST be immutable after creation — no domain mutator and no repository update/delete path may exist. A Profile that cycles through reject → re-apply → approve → deactivate MUST accumulate one `ProfileReview` row per admin decision, in order, with none of the prior rows overwritten or removed.

#### Scenario: Reject then re-apply then approve preserves both the reject and the approve basis

- GIVEN a PENDING profile that an Admin rejects with basis "no verifiable convenio", after which the applicant re-registers, and an Admin later approves it with basis "convenio VTT-2026-014 confirmed by phone"
- WHEN the profile's review history is read
- THEN it contains TWO `ProfileReview` rows, in order — the reject row with its original basis intact, and a SEPARATE approve row with its own basis — neither overwriting the other

#### Scenario: A later deactivation adds a further row without touching prior ones

- GIVEN the profile from the prior scenario is now ACTIVE and is later deactivated with basis "convenio lapsed"
- WHEN the profile's review history is read
- THEN it contains THREE `ProfileReview` rows in order (reject, approve, deactivate), each with its own distinct, unmodified basis

#### Scenario: No domain or repository path can update or delete a review row

- GIVEN an existing `ProfileReview` row
- WHEN the codebase's domain and persistence surfaces are inspected
- THEN no function exists that mutates or deletes a `ProfileReview` row — the only operation available is creating a new one

### Requirement: The Review Write Commits Atomically With the Status Transition and Session Revocation

The `ProfileReview` write MUST be persisted inside the same locked transaction (`withLockedProfile`) that already carries the status change and, on reject/deactivate, the session-revocation cascade. A failure between the status write and the review write MUST leave neither committed.

#### Scenario: A successful decision commits the status change and the review together

- GIVEN a PENDING profile and a valid basis
- WHEN an Admin approves it
- THEN both the profile's new `status` and the `ProfileReview` row are visible after the call returns, committed as one unit

#### Scenario: A forced failure after the status write leaves no partial state

- GIVEN a valid approve/reject/deactivate call where the underlying transaction is forced to fail after the status write but before the transaction commits
- WHEN the failure occurs
- THEN neither the status change nor the `ProfileReview` row is persisted — the profile reads exactly as it did before the call
