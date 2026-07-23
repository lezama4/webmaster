# Centre Registration Specification

## Purpose

Governs how a prospective care organisation registers as a **centre** (generic `AccountRole`/`ProfileType`, Prisma `CENTRE`) and declares its **`centreType`** — one of six kinds (`hospital`, `nursing_home`, `day_centre`, `day_hospital`, `occupational_centre`, `palliative_unit`). Registration stays self-declared and admin-validated, exactly as it is for hospitals today (ADR D16/D18). This spec also fixes the authorization invariant that makes the seventh-type-is-data claim true: role/profile-type authorize; `centreType` never does.

## Requirements

### Requirement: A Registering Centre Must Declare Exactly One of Six Centre Types

When the selected role is `centre`, `centreType` MUST be present and MUST be one of the six known values. The server-side use case (`registerProfile`) MUST enforce this independently of client-side validation. An `artist` registration MUST NOT carry a `centreType`.

#### Scenario: Each of the six centre types can register

- GIVEN a prospective organisation submits registration with `role: centre` and one of `centreType ∈ {hospital, nursing_home, day_centre, day_hospital, occupational_centre, palliative_unit}`
- WHEN each of the six requests is submitted independently
- THEN each creates a new profile with `status: PENDING`, `type: centre`, and the submitted `centreType` persisted unchanged

#### Scenario: centreType is required for a centre role

- GIVEN a registration request with `role: centre` and no `centreType`
- WHEN the request reaches `registerProfile`
- THEN it is rejected before a profile is created, regardless of what client-side validation allowed through

#### Scenario: centreType is constrained to the six known values

- GIVEN a registration request with `role: centre` and `centreType: "prison"` (not one of the six)
- WHEN the request reaches `registerProfile`
- THEN `assertValidCentreType` rejects it and no profile is created

#### Scenario: An artist registration forbids centreType

- GIVEN a registration request with `role: artist` and a `centreType` value present
- WHEN the request reaches `registerProfile`
- THEN it is rejected — an artist profile MUST NOT carry a `centreType`

### Requirement: Admin Validates Any of the Six Centre Types Through One Flow

The admin pending-profile queue and its approve/reject action MUST work identically regardless of `centreType`. Approving a PENDING centre profile of any kind MUST activate it and grant it the same slot-publishing capability as any other active centre.

#### Scenario: Admin validates a centre of a given type

- GIVEN a PENDING profile with `type: centre` and `centreType: "palliative_unit"`
- WHEN an Admin approves it through the pending-profile validation flow
- THEN the profile becomes `status: ACTIVE`, `centreType` is unchanged, and it can publish Slots exactly as any other active centre can

### Requirement: Authorization Checks Only the Centre Role, Never centreType

Every guard gating a centre-only action (`publishSlot`, `closeSlot`, `approveProposal`, `rejectProposal`, `listHospitalSlots`) MUST authorize by checking only the `centre` role/profile-type. No guard MUST branch on, read, or reject based on `centreType`. This is what makes adding a seventh `centreType` a data change, not a code change (D16).

#### Scenario: Guard authorises regardless of centreType

- GIVEN two ACTIVE centre profiles with different `centreType` values (`hospital` and `day_centre`)
- WHEN each performs the same authenticated centre-only action
- THEN both are authorised by the identical guard check, with no condition referencing `centreType`

#### Scenario: An unknown or manipulated centreType cannot affect authorization outcome

- GIVEN a request context where `centreType` is set to an arbitrary or unknown string
- WHEN it reaches `assertRole` or `assertActiveProfile`
- THEN the authorization result depends only on `role`/`type`, never on the value of `centreType`

### Requirement: Existing Hospital Accounts Keep Working Unchanged

An Account/Profile created before this change under the pre-migration `hospital` role MUST continue to authenticate and perform every centre-only action after migration, with zero behavioural change from the account holder's perspective.

#### Scenario: Pre-migration hospital account is unaffected

- GIVEN an Account whose role was `hospital` before this change's migration ran
- WHEN it authenticates and performs a centre-only action (publish/close a Slot, approve/reject a Proposal) after migration
- THEN it is authorised exactly as before, because its role now reads `centre` and its profile carries `centreType: "hospital"`
