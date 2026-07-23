# Proposal — auditable-profile-approval

**Depends on:** `bootstrap-vivetutiempo-platform` (D1–D8, deployed), `hospital-finder-and-home-clarity` (D9–D15, deployed) and `widen-beyond-hospitals` (D16–D20). **ADR numbering continues the single register — the last change owned D16–D20, so this change owns D21–D27.**

## 1. Problem

Profile onboarding is **fully self-declared and the admin decision on it records nothing.** Anyone can `POST /api/auth/register` with an email, a password, a role (`centre` or `artist`) and — for a centre — a `centreType`, and receive a `pending` Profile (`registerProfile.ts`, verified). An admin then "validates" it through `validateProfile` → `approveProfile(profile)` in `src/domain/profile/Profile.ts:293`. That domain function is a **pure state transition and nothing else**:

```ts
export function approveProfile(profile: Profile): Profile {
  assertStatus(profile, "pending", "approve");
  return { ...profile, status: "active" };
}
```

`rejectProfile` (`:299`) and `deactivateProfile` (`:305`) are identical in shape — a status flip that records **who** decided nothing, **when** nothing, **on what basis** nothing. The only durable trace anywhere near a review is `reviewRequestedAt` (`Profile.ts:79`), and that timestamps **the applicant asking for re-review**, not the admin's decision. The threat model already names this gap as an accepted, unmitigated risk (**T-22**, `docs/security-threat-model.md:389`): verification "stays self-declared with admin validation (unchanged in shape)".

So two true statements hold at once: **"cualquiera se puede dar de alta"**, and **the one human control that gates a self-declared registration — the admin approval — is itself unaccountable.** There is no answer to "who approved this centre, when, and on the strength of what verification?" — the record does not exist to be produced.

## 2. Why it matters — the risk asymmetry

The two roles are **not** symmetric in the harm a bad approval enables, and the design is framed around that asymmetry:

- A **centre** is the **powerful node.** Once active it publishes Slots, controls the ward-level agenda, and **approves which artist fills each Slot** (`approveProposal`, centre-guarded). It is the gatekeeper of what reaches vulnerable patients, and it is gated by **exactly one** human decision: the admin approval. If that decision is unaccountable, the most powerful actor in the graph entered on nobody's recorded judgement.
- An **artist** is **double-gated** — the admin approves the profile **and** a centre approves each individual proposal — but the artist is the one **physically present with vulnerable people** (patients, residents, people with cognitive impairment; the `widen-beyond-hospitals` populations, T-22).

A centre's approval therefore concentrates institutional power behind a single decision; an artist's approval is the first of two gates but authorises physical presence. **Both admin decisions must become accountable, and each must prompt for the verification that is actually relevant to its risk.**

## 3. What we are building (and deliberately NOT)

Decided scope — the **lean, auditable-decision MVP**. We make the admin decision an **accountable, recorded act**; we do **not** build the real-world verification machinery.

**In scope:**

1. **The admin decision (approve / reject / deactivate) becomes an auditable record** capturing **WHO** (the acting admin's account id), **WHEN** (a domain clock timestamp) and a **REQUIRED verification basis** — a bounded, non-blank note. **You cannot approve, reject or deactivate without recording why**, enforced at the domain, not merely the form.
2. **A role-specific basis prompt.** A centre's prompt cues **institutional** verification (convenio / out-of-band contact with the named institution); an artist's cues **identity + a safeguarding attestation.** This is UI/i18n copy — the domain only requires a valid basis string; the prompt shapes what the admin is asked to attest.
3. **The admin queue UI** gains the basis input on the approve / reject action, and (for deactivation) on the deactivate action.
4. **The threat model** (`docs/security-threat-model.md`) is updated: this auditable decision is named as the **built** control; the offline process (convenio, certificate, out-of-band verification, accreditation) is named as the **real-world** control and **future work**, to be built **if and when the site goes public with real data.**

**Explicitly out of scope (documented as future / real-world work — "no nos columpiamos"):**

- The **collaboration-agreement (convenio) flow**, certificate/accreditation **upload**, and any **background-check** integration. These are the T-22 follow-on. They are named, not built.
- Any change to **who** may approve (still admin-only) or to the **state machine** itself (`pending → active | rejected`, `active → deactivated`, `rejected → pending`). We record the decisions on the existing transitions; we do not add new ones.
- Any **public** exposure of the audit data (see §5).

## 4. Approach in one line

Turn each admin transition from a **pure status flip** into **"status flip **plus** an append-only, attributed, reasoned review record, committed atomically"** — the transition and its evidence become inseparable, so the domain makes it impossible to change a Profile's status without producing a valid record of who did it and why. Everything else (the role-specific prompt, the queue input) hangs off that one structural move. Detailed in `design.md` (D21–D27).

## 5. Non-goals and boundaries (safety-critical)

- **The audit trail is never public.** Review basis, admin identity and review timestamps must never reach `PublicEventProjection` (D6) or `PublicHospitalProjection` (D9/D19). Both public surfaces are explicit allow-lists rebuilt field-by-field; the audit data lives off the projected shape entirely, and the D14 forbidden-key compile assert is extended to name it (D26).
- **No fabricated history.** Profiles that were approved/rejected/deactivated **before** this change have **no** recorded basis. They read as **"legacy: no basis recorded"** — never a back-filled, invented justification, which would be worse than an honest gap (D25).
- **No data loss.** The change is **additive** to persistence; not one existing Profile row is rewritten or dropped (D25).
- **Shape-preserving.** Admin-only authorization, CSRF, the lock-first `withLockedProfile` transaction and session-revocation cascades are all unchanged; the review write joins the **existing** atomic unit (D23).

## 6. Risks (carried into design)

| # | Risk | Where addressed |
|---|---|---|
| R1 | An "audit" that overwrites itself on the second decision is not an audit — a reject→re-apply→approve cycle would destroy the reject basis. | D21 (append-only record) |
| R2 | Basis is enforced only in the UI, so a scripted `POST` approves with no reason. | D24 (domain-level, fail-closed) |
| R3 | Admin identity is taken from client input and spoofed. | D23 (from the live-session `Actor`, never the request body) |
| R4 | Audit fields leak onto a public surface. | D26 (allow-list rebuild + extended D14 guard) |
| R5 | Legacy rows are back-filled with a fabricated basis, creating false evidence. | D25 (legacy reads honestly as "no basis recorded") |
| R6 | The review write is not atomic with the transition/revocation, leaving partial state. | D23 (joins the existing `withLockedProfile` unit) |
| R7 | An unbounded basis note becomes a text-injection / storage-abuse vector (T-15). | D24 (bounded max length, trimmed, domain-enforced) |
| R8 | The role-specific prompt implies a verification depth the code does not deliver. | D27 + threat-model wording gate (the prompt asks the admin to attest; it does not itself verify) |

## 7. Success criteria

- No admin transition (approve / reject / deactivate) can complete without an attributed, non-blank, bounded basis — provable by a domain unit test that a blank basis throws before any status change.
- Every recorded decision answers who / when / why, and a reject→re-apply→approve cycle preserves **all three** decisions in order.
- The public directory and event JSON contain **zero** audit fields — provable by the existing exact-key-set / no-leak tests, unchanged in intent.
- Existing profiles survive the migration and read as "legacy: no basis recorded".
- The threat model states plainly which control is built (auditable decision) and which is future (offline verification), with no claim the code does not implement.
