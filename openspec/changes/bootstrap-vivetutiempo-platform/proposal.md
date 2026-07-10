# Proposal — bootstrap-vivetutiempo-platform

**Project:** Vivetutiempo (web master)
**Change:** `bootstrap-vivetutiempo-platform`
**Phase:** Proposal (PRD altitude — no technical design, no specs)
**Persistence:** hybrid (this file + Engram `sdd/bootstrap-vivetutiempo-platform/proposal`)
**Scope of this proposal:** Block 1 (Core). Blocks 2 and 3 are noted as planned follow-on scope only.

---

## 1. Intent

### The problem
In hospitals, patients and their families spend long stretches of idle time — waiting, accompanying, recovering. Cultural, artistic, musical and human activities make that time more bearable and improve the human experience of the hospital environment. Several initiatives already run art-in-hospitals programs in Spain, but the real gap is not "putting on events" — it is **coordinating them safely and traceably** across the parties involved: hospitals with available agenda slots, artists/dynamizers who can fill them, and the patients/families who ultimately benefit.

Vivetutiempo is a free, non-profit platform whose differentiator is exactly this: a **multi-role digital coordination platform** with agenda, matching, approval, governance and traceability — not "art in hospitals" in the abstract.

### Why now
This change is the deliverable of a Master's final project (TFM) in AI-assisted software development. The academic goal is to demonstrate mastery of the disciplines taught in the program: Spec-Driven Development, Clean/Hexagonal Architecture in TypeScript, layered testing, security by design (OWASP), and demonstrable quality — through a **real, deployable, end-to-end application**, not a mockup. The deliverable includes a public GitHub repo, a working deployment URL, a README, slides, and a screen-capture explainer video. That framing drives every scope decision below: the core must be genuinely deployable and demonstrable end to end.

### What success looks like
A deployed, working Core (Block 1) that a reviewer can exercise end to end using test credentials:

1. Users log in with pre-seeded test accounts across the four roles.
2. A Hospital publishes an agenda Slot.
3. An Artist submits a Proposal for that Slot.
4. The owning Hospital approves or rejects the Proposal.
5. An approved Proposal becomes a published Event.
6. Anyone (no login) can browse published Events publicly.

The Core is considered done only when it is **deployed and demonstrably working** before any Block 2/3 work begins. Half-finished blocks are not acceptable — this is a strict sequence.

---

## 2. Target users and situations

| Role | Who they are | Key moment in the Core flow |
|---|---|---|
| **Hospital** | Hospital / center staff managing agenda availability | Publishes Slots; decides which competing Proposal fills each Slot |
| **Artist** (dynamizer / volunteer) | Person offering a cultural/artistic/human activity | Discovers open Slots and submits Proposals for them |
| **Admin** | Platform governance | Validates Hospital and Artist profiles; moderates security/reputation |
| **Patient / Family** | The beneficiaries of the activities | Browse published Events (public, anonymous); a lightweight account is only needed later for rating (Block 2) |

**Public visitor (anonymous):** Browsing published Events requires no account at all. This is the front door of the platform and must work without friction.

---

## 3. Scope

### In scope (Block 1 — Core, this change)
- **Role-based authentication** for Hospital, Artist, Admin, Patient/Family, with pre-seeded test credentials for demonstration.
- **Self-registration** for Hospitals and Artists, producing a profile in `PENDING` state until an Admin validates it.
- **Admin profile validation**: move a Hospital/Artist profile `pending → active` or `pending → rejected`.
- **Slot publishing** by a Hospital (agenda availability).
- **Proposal submission** by an Artist against an open Slot.
- **Proposal approval/rejection** by the Hospital that owns the Slot.
- **Automatic event creation** when a Proposal is accepted, followed by publication of that Event.
- **Public browsing** of published Events (anonymous, no login).
- **Deployment** of the working Core to the target environment (Vercel + managed Postgres) with a reachable URL.
- **Test-runner scaffolding** so that strict TDD can later be enabled in `domain/` and `application/` (currently OFF).

### Out of scope (non-goals)
- **Real payments** — patronage is only a simulated flow, and only in Block 3. A real payment integration, if ever added, arrives later as a new adapter behind a `PaymentGateway` port.
- **Star ratings / reputation** — Block 2, not this change.
- **Patronage / support campaigns** — Block 3, not this change.
- **Fiscal deduction certificates** — treated strictly as a future legal/compliance hypothesis, never promised as product.
- **Hospital-system integration** (real EHR/agenda systems).
- **Full legal management** of volunteering, insurance, or safeguarding of minors.
- **Native mobile app.**
- **Kubernetes / AWS infrastructure** — deployment is Vercel + managed Postgres; Docker is used only for local Postgres.

### Planned follow-on scope (architecture must leave room, do NOT build now)
- **Block 2 — Rating:** star rating of Events after they occur, introducing a Reputation/Feedback domain. Requires a lightweight Patient/Family account (email); one rating per person per Event.
- **Block 3 — Patronage:** simulated support campaigns modeled as a `PaymentGateway` port with a `FakePaymentGateway` adapter, plus a Patron/donor role. "No real payments" becomes a defensible Clean Architecture strength: a future real gateway is just another adapter.

The Core domain model must not preclude the later Reputation domain nor the `PaymentGateway` port.

---

## 4. Business rules (decided — bake these into specs)

1. **Registration & validation.** Hospitals and Artists self-register, but their profile remains `PENDING` and cannot act until an Admin validates it. Account/profile lifecycle: `pending → active` or `pending → rejected`. Authority: **Admin**.
2. **Identity & access.** Browsing published Events is **public/anonymous** (no login). Rating (Block 2) will require a lightweight Patient/Family account (email), with **one rating per person per Event**.
3. **Matching model.** A single Slot can receive **multiple competing Proposals**. The Hospital **chooses** one — it is not first-come-first-served.
4. **Two distinct validation layers.**
   - The **Hospital that owns a Slot** approves/rejects Proposals to *its* Slots.
   - The **Admin** moderates profiles, security and reputation. The Admin does **not** approve Proposals.
5. **Key domain invariant.** Accepting one Proposal for a Slot **automatically rejects the other pending Proposals** for that same Slot.

### Candidate domain state machines (for the spec/design phases to formalize)
- **Account/Profile:** `pending → active` / `pending → rejected`
- **Slot:** `open → filled` / `open → closed`
- **Proposal:** `submitted → accepted` / `submitted → rejected`
- **Event:** `created (on accept) → published → completed`

---

## 5. Success criteria

- A reviewer can log in with test credentials for each of the four roles.
- The full chain works end to end: Hospital publishes Slot → Artist proposes → Hospital approves → Event published → public browsing shows it.
- The "accept one Proposal auto-rejects the rest for that Slot" invariant is observable in the running app.
- An Admin can move a pending Hospital/Artist profile to active or rejected, and only active profiles can act.
- Public Event browsing works without any login.
- The Core is **deployed** to a reachable URL (Vercel + managed Postgres).
- Domain and application business rules are covered by tests; the test runner is scaffolded so strict TDD can be switched on.
- The repository, README and deployment are presentable as a TFM deliverable.

---

## 6. Impact

- **Product/UX:** Establishes the platform's spine — the coordination workflow that differentiates Vivetutiempo. Public browsing is the outward face; the role-gated workflow is the operational core.
- **Architecture:** Sets the hexagonal boundaries (`domain/`, `application/`, `infrastructure/`, `ui/`) that all later blocks inherit. Getting the Slot/Proposal/Event/Account state machines right now is what makes Blocks 2 and 3 cheap to add.
- **Governance & trust:** Two-layer validation (Admin for profiles, Hospital for its own Slots) is a product-credibility feature in a hospital context, not just an implementation detail.
- **Delivery/academic:** A deployed, demonstrable Core is the difference between a passing TFM and a strong one. It also unblocks the test-runner scaffolding needed to enable strict TDD for the remaining blocks.
- **Operational:** Minimal — no real integrations, no payment processing, no PII beyond lightweight accounts. Managed Postgres + Vercel keeps ops cost near zero.

---

## 7. Key edge cases (to be specified/designed, flagged here)

- **Pending accounts acting too early:** a Hospital/Artist whose profile is still `pending` (or `rejected`) attempts to publish a Slot or submit a Proposal.
- **Concurrent approvals:** two competing Proposals for the same Slot, and the auto-reject cascade when one is accepted — including race conditions if two approvals arrive close together.
- **Approving into a non-open Slot:** approving a Proposal for a Slot already `filled` or `closed`.
- **Cross-tenant authority:** a Hospital attempting to approve/reject Proposals on a Slot it does not own.
- **Empty states:** no published Events yet (public browsing landing), no Proposals on a Slot, no pending profiles for the Admin.
- **Rejected-then-resubmit:** an Artist re-proposing after a rejection; a rejected profile attempting to re-register.
- **Deleted/withdrawn Slot** while Proposals are outstanding.
- **Test-credential seeding:** ensuring the demo dataset reliably reproduces the full flow.

---

## 8. Product tradeoffs and assumptions

- **Sequential blocks over parallel breadth.** We deliver a fully working, deployed Core before touching rating or patronage. Risk: less feature breadth in the demo. Rationale: a shallow-but-complete vertical slice demonstrates architecture and quality far better than several half-finished features — and matches the TFM's "real, deployable" bar.
- **Simulated patronage as an architectural asset.** Rather than treating "no payments" as a gap, Block 3 models it as a `PaymentGateway` port + `FakePaymentGateway` adapter. Tradeoff: extra abstraction now for zero user-visible payment value; payoff: a textbook demonstration of ports/adapters and a clean upgrade path.
- **Public anonymous browsing.** Lowering the barrier for patients/families increases reach but means the most-visited surface has no auth context. Assumption: published Events contain no sensitive data.
- **Admin-gated onboarding.** Self-registration with mandatory Admin validation adds friction and an operational bottleneck. Assumption acceptable for a trust-sensitive hospital context and a demo-scale user base.
- **Hospital picks the winner (not FIFO).** Gives hospitals real curation control and models the domain honestly. Tradeoff: more UI/decision surface than an automatic match.
- **Deployment target simplification.** Vercel + managed Postgres instead of the originally-defaulted Docker+K8s+AWS stack. Tradeoff: less "enterprise infra" to show; rationale: reliable, low-cost, genuinely-deployable delivery beats infra theater for a TFM. Documented as a deliberate decision.

### Assumptions to confirm (open questions)
- Auth mechanism specifics (session vs JWT) are a **design-phase** decision, not decided here.
- Whether the Patient/Family role needs any presence in Block 1 beyond being an anonymous browser (it becomes a real account in Block 2).
- Exact seed dataset (how many hospitals/artists/slots) for a convincing demo.
- Whether a Slot has scheduling attributes (date/time/capacity) rich enough for the demo, or a minimal shape suffices for Block 1.

---

## 9. Rollback plan

This change bootstraps a greenfield application; there is no production system to regress. Rollback is therefore low-risk:

- **Version control:** all work lands in a public Git repo; any block can be reverted via Git. Blocks ship as reviewable increments.
- **Deployment:** Vercel supports instant redeploy of a previous build; managed Postgres (Neon/Supabase) supports point-in-time restore. A bad deploy is rolled back by promoting the last good build.
- **Data:** the Core relies on seeded/test data only — no irreversible user data at stake during Block 1.
- **Sequence discipline:** because blocks are strictly sequential and each is deployed working before the next, a failure is contained to the current block and reverts cleanly to the last deployed-good state.

---

## 10. Next phase

- `sdd-spec` — formalize scenarios (Given/When/Then, RFC 2119) for the Core flow, role-based access per actor, and the state machines/invariants above.
- `sdd-design` — architecture decisions: hexagonal boundaries, domain model for Slot/Proposal/Event/Account, auth mechanism, persistence, and the seams that keep Blocks 2/3 (Reputation domain, `PaymentGateway` port) cheap to add.

`sdd-spec` and `sdd-design` can run in parallel; both depend only on this proposal.
