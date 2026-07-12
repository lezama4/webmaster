# PR 2a remediation verification — adversarial read-only review

## Scope and method

Read-only comparison of the original review, committed application code, the
application unit tests, and `Profile.ts`. No Git command and no test, build, or
install command was run, as required. Statuses below establish what the
application implementation and unit tests evidence; they do not validate a
future infrastructure adapter.

## Verdict by original finding

| Finding | Verdict | Evidence and assessment |
| --- | --- | --- |
| **pr2a-B1** | **RESOLVED** | `listPublishedEvents` maps every port record through a fresh, field-by-field DTO (`src/application/use-cases/listPublishedEvents.ts:25-39`). The hostile-adapter test injects location, messages, email, and identifiers, and proves they are absent (`tests/unit/application/listPublishedEvents.test.ts:70-110`). |
| **pr2a-B2** | **RESOLVED** | Existing-account registration verifies the supplied password before any transition (`src/application/use-cases/registerProfile.ts:61-70`) and denies a requested role different from the stored role (`src/application/use-cases/registerProfile.ts:72-79`). Wrong-password, role-mismatch, and profile-less-account tests cover the requested paths (`tests/unit/application/registerProfile.test.ts:149-228`). |
| **pr2a-M1** | **PARTIAL** | The live Profile is now read inside `ProfileUnitOfWork` (`src/application/use-cases/publishSlot.ts:54-71`; `src/application/use-cases/submitProposal.ts:41-67`; equivalent nesting in `approveProposal.ts:41-84`, `rejectProposal.ts:38-61`, and `closeSlot.ts:39-72`). However, for Slot mutations the inner Profile lock completes before `FakeMatchingUnitOfWork` persists the mutation (`tests/unit/application/support/fakes.ts:298-319` versus `:340-361`). A deactivation can therefore commit after authorization is checked but before the Slot mutation commits. The only test forces deactivation to commit *before* the profile check; it does not exercise this remaining window (`tests/unit/application/submitProposal.test.ts:181-198`). |
| **pr2a-M2** | **RESOLVED** | `LoginContext.ipHash` is passed in the attempt key (`src/application/use-cases/login.ts:15-24, 88-95`) and is used for failure and success accounting (`:109, 118, 137`). Unknown accounts execute `verify` against a dummy hash before generic denial (`:101-110`). The test spies on both unknown and wrong-password paths and checks equal verification calls (`tests/unit/application/login.test.ts:216-255`). |
| **pr2a-M3** | **PARTIAL** | The intended linearization contract is now explicitly documented and login checks status plus creates the session under one Profile UoW (`src/application/use-cases/login.ts:62-86, 122-138`); deactivation revokes sessions inside that UoW (`src/application/use-cases/deactivateProfile.ts:36-53`). Ordering A is queued concurrently (`tests/unit/application/login.test.ts:161-184`), but ordering B is expressly sequential rather than an in-flight race (`:186-214`). It confirms the final state, not the required two-order barrier/interleaving behaviour. |
| **pr2a-M4** | **PARTIAL** | The fake now rejects absolute and idle expiry in `resolveValid` (`tests/unit/application/support/fakes.ts:200-245`) and has direct expiry/touch tests (`tests/unit/application/fakeContracts.test.ts:27-79`). Its matching UoW snapshots all three stores and restores after a persist-phase failure (`tests/unit/application/support/fakes.ts:300-315`), with failure injection (`tests/unit/application/fakeContracts.test.ts:81-125`). But `touch` updates a session regardless of whether it is already idle- or absolute-expired (`tests/unit/application/support/fakes.ts:237-245`), allowing a late touch to revive it; see new finding `pr2a-verify-M1`. |
| **pr2a-M5** | **PARTIAL** | Registration is routed through a dedicated lock-first UoW (`src/application/use-cases/registerProfile.ts:58-123`) whose contract requires atomic persistence and `ConflictError` on durable uniqueness violations (`src/application/ports/RegistrationUnitOfWork.ts:35-50`). The fake rolls back Account/Profile stores and tests an injected Profile save failure (`tests/unit/application/support/fakes.ts:395-425`; `tests/unit/application/registerProfile.test.ts:295-330`). The only concurrent test uses a global serial fake and a different second password, expecting `UnauthenticatedError` rather than exercising a durable uniqueness violation mapped to `ConflictError` (`tests/unit/application/registerProfile.test.ts:251-293`). Thus the required mapping remains contractual, not verified behaviour. |
| **pr2a-M6** | **PARTIAL** | Duplicate submissions are now started without awaiting either call and assert one success, one conflict, and one durable submitted proposal (`tests/unit/application/submitProposal.test.ts:134-155`). This is an improvement over the sequential test. It uses no controllable barrier, however, and no tests were added for the other specified interleavings (submit/approve, submit/close, approve/reject, approve/close). The queue fake itself deterministically serializes work (`tests/unit/application/support/fakes.ts:292-320`), so this does not prove the intended contention points. |
| **pr2a-N1** | **RESOLVED** | `assertActiveProfile` now rejects a live Profile whose type differs from the expected role type (`src/application/use-cases/shared/guards.ts:24-42`), and the affected use cases supply that type (for example `submitProposal.ts:39-45`). Corrupted role/type combinations are covered (`tests/unit/application/submitProposal.test.ts:103-118`; `tests/unit/application/listOpenSlots.test.ts:100-114`). |
| **pr2a-N2** | **RESOLVED** | Runtime decisions outside `approve`/`reject` cause `DomainValidationError` before lookup or mutation (`src/application/use-cases/validateProfile.ts:34-42`). The malformed-decision test verifies both the error and unchanged pending state (`tests/unit/application/validateProfile.test.ts:157-175`). |
| **pr2a-N3** | **RESOLVED** | The use case performs one actor-profile check then delegates the joined listing to `OpenSlotListingQuery` (`src/application/use-cases/listOpenSlots.ts:31-42`). The port defines a dedicated joined result and fail-fast broken-relation contract (`src/application/ports/OpenSlotListingQuery.ts:16-27`); the tests cover both delegation and error propagation (`tests/unit/application/listOpenSlots.test.ts:57-80, 116-132`). |

## New findings

### pr2a-verify-M1 — `FakeSessionPort.touch` can revive an expired session

**References:** `tests/unit/application/support/fakes.ts:229-245`,
`src/application/ports/SessionPort.ts:14-29`,
`tests/unit/application/fakeContracts.test.ts:38-73`.

`resolveValid` correctly rejects expired sessions, but `touch` does not first
require the session to be currently absolute- and idle-valid. A caller that
touches after expiry overwrites `lastActiveAt`; unless the absolute deadline has
also passed, the next `resolveValid` accepts the session again. The tests cover
touch just before expiry, not touch after expiry. This makes the fake's
session-expiry evidence unreliable and leaves `pr2a-M4` partial. Make `touch`
conditional on both validity windows (and treat a missing/expired row as no
touch), then test idle-expiry and absolute-expiry boundaries.

### pr2a-verify-M2 — Slot authorization and persistence are not one transaction

**References:** `src/application/use-cases/submitProposal.ts:41-68`,
`tests/unit/application/support/fakes.ts:292-320, 340-361`,
`tests/unit/application/submitProposal.test.ts:181-198`.

The Profile UoW nested in the Slot UoW releases before the Slot UoW's persist
phase. Therefore the claimed live-status check is not held until the authorized
Slot mutation commits. A deactivation can linearize in that gap, after the
check but before persistence. This is the remaining core of `pr2a-M1`, rather
than a closed race. Use one transaction context that locks and reads both
resources through the final Slot write, with a documented global lock order,
and add a barrier test that forces that exact ordering.

## Conclusion

Four findings are resolved (`B1`, `B2`, `M2`, `N1`–`N3`). Five are only
partially remediated (`M1`, `M3`–`M6`). No regression from the prior committed
application behaviour was established by reading alone, but the two new major
findings above prevent treating the remediation as fully closed.
