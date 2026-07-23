# Delta for Admin Review UI

## ADDED Requirements

### Requirement: The Admin Queue Requires a Basis Before Approve, Reject, or Deactivate Can Submit

The admin pending-profile queue's approve and reject actions, and the deactivate action wherever it is triggered, MUST present a basis input and MUST NOT allow the action to submit while it is blank. This is a UI-level convenience gate; the authoritative check is the domain (see `auditable-admin-decisions`).

#### Scenario: Approve/reject cannot be submitted with an empty basis

- GIVEN the admin queue's approve or reject control for a PENDING profile
- WHEN the admin attempts to submit without entering a basis
- THEN the submission is blocked client-side and no request is sent

#### Scenario: Deactivate cannot be submitted with an empty basis

- GIVEN the deactivate control for an ACTIVE profile
- WHEN the admin attempts to submit without entering a basis
- THEN the submission is blocked client-side and no request is sent

#### Scenario: A filled-in basis allows the action to submit

- GIVEN the admin queue's approve, reject, or deactivate control with a non-blank basis entered
- WHEN the admin submits
- THEN the request is sent carrying that basis

### Requirement: The Basis Prompt Is Role-Specific — Institutional for a Centre, Identity and Safeguarding for an Artist

The basis input's placeholder/prompt copy MUST differ by the profile's role: for a `centre`, it MUST cue institutional verification (collaboration-agreement/convenio reference, or out-of-band contact with the named institution); for an `artist`, it MUST cue identity verification and a safeguarding attestation. This is UI/i18n copy only — the domain accepts any valid basis string regardless of role (ADR D27).

#### Scenario (e2e-checkable): A centre's basis input shows the institutional prompt

- GIVEN a PENDING profile with `type: centre` in the admin queue
- WHEN the basis input for its approve/reject action is rendered
- THEN its placeholder/prompt text cues convenio/institutional verification, not the artist-specific wording

#### Scenario (e2e-checkable): An artist's basis input shows the identity and safeguarding prompt

- GIVEN a PENDING profile with `type: artist` in the admin queue
- WHEN the basis input for its approve/reject action is rendered
- THEN its placeholder/prompt text cues identity verification and a safeguarding attestation, not the centre-specific wording

#### Scenario (manual review, not automated): The role-specific prompt reads correctly and asks the right question

- GIVEN the centre and artist basis prompts as shipped, in `es`/`en` (and `eu` as DRAFT)
- WHEN a human reviewer reads each prompt from the perspective of an admin about to make the decision
- THEN the centre prompt clearly asks for institutional/convenio verification and the artist prompt clearly asks for identity + safeguarding verification, with no ambiguity about which question is being asked
- (Manual review only — no mechanical check can assess whether a prompt "asks the right question"; the `eu` variant additionally requires native-speaker sign-off per the project's Basque-quality gate convention)

### Requirement: No Copy May Imply the Platform Performed a Verification It Did Not Perform (Honesty Gate, R8)

The basis prompt, its help text, and any related documentation MUST ask the admin to **attest** to a verification they performed; none of it may state or imply that the platform itself verified a convenio, checked an identity, or ran a background check. The built control is an accountable, recorded human decision — not an automated or platform-performed verification.

#### Scenario (manual review, not automated): Basis prompt copy does not overclaim platform verification

- GIVEN the centre and artist basis prompts, their help text, and the admin-facing copy around them, as shipped
- WHEN a reviewer reads this copy specifically checking for verbs that would imply the platform verified, confirmed, or checked something automatically
- THEN no such claim appears — the copy consistently asks the admin to attest to verification they themselves performed
