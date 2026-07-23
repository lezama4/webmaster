# Vivetutiempo — Outline for TFM Defence Slides

**Target duration:** 12–15 minutes  
**Target length:** 17 slides  
**Evidence cut-off:** revision `482aefd` on `main`, 2026-07-22.

All four layers are implemented, the application is deployed at
<https://webmaster-lemon.vercel.app> serving the seeded demo dataset, and CI run
[29905717933](https://github.com/lezama4/webmaster/actions/runs/29905717933) is
green on both jobs — `test` 360 passed / 0 skipped (unit plus PostgreSQL 16
integration and concurrency), `e2e` 12 Playwright tests passed against real
PostgreSQL and seeded data.

**What must still not be presented as done:** production hardening. There are no
security response headers, no CSP, no application logging and no dependency
scanning. Block 2 (ratings) and Block 3 (simulated patronage) are future scope
and exist only on unmerged branches. The repository is currently **private**.

**On the six-centre-type generalisation (`widen-beyond-hospitals`, ADRs
D16–D20).** This outline reflects the generalised product — six centre types
(hospital, nursing home, day centre, day hospital, occupational centre,
palliative unit), not hospitals only. That change is implemented and verified
locally against real PostgreSQL (Neon `dev`), but is **not yet merged to `main`
or deployed**, and its Basque copy is a **draft pending native review**. On the
day, present the six types as demonstrable in the seeded environment, not as live
in production, unless the chain has been merged and deployed by then. Keep this
document an outline; the deck itself is still to be produced.

## Slide 1 — Vivetutiempo ("Todo el tiempo cuenta"): turning idle time in care centres into living time

**Suggested time:** 0:30

**Bullets**

- Master’s Final Project: secure coordination of cultural activities in care
  centres — hospitals and five further centre types.
- A non-profit, multi-role web platform. Visible product name: "Todo el tiempo cuenta".
- Author, Master’s programme, academic year, supervisor.

**Visual**

- Minimal title image or diagram: Care centre ↔ Artist → Published Event → People/Families.

**Speaker note**

“This project is not a clinical information system and it does not manage health
records. It addresses a narrower but real coordination problem: how to turn
available time in care centres — a hospital, but also a nursing home, a day
centre, a day hospital, an occupational centre or a palliative unit — and
cultural offers into safe, traceable public events.”

---

## Slide 2 — The problem: idle time requires coordination, not only good ideas

**Suggested time:** 0:45

**Bullets**

- People in care centres — and their families — may spend long periods waiting,
  accompanying or recovering, in a hospital or in a residence, day centre or
  palliative unit.
- Cultural and human activities can improve that experience.
- The hard part is operational coordination: availability, proposals, approval,
  governance, and safe public communication.
- A care-centre context makes location, identity, and private messages sensitive by context.

**Visual**

- Three disconnected icons labelled “hospital agenda”, “artist offer”, and
  “public information”, followed by a highlighted coordination gap.

**Speaker note**

“The differentiator is not claiming to invent culture in care settings. It is
modelling the coordination layer that connects an available slot in a care
centre with competing activity proposals, while preserving governance and
confidentiality.”

---

## Slide 3 — The solution: Vivetutiempo

**Suggested time:** 0:45

**Bullets**

- A care centre publishes an agenda Slot.
- Active Artists submit competing Proposals.
- The owning centre accepts one or rejects proposals.
- Acceptance creates and publishes an Event.
- Anyone can browse published Events anonymously.
- "Centre" is a single generic role; the six centre types live on a separate
  `CentreType` axis, not in the role (see Slide 6).

**Visual**

```text
Centre Slot → Artist Proposal(s) → Centre decision → Published Event → Public browsing
```

**Speaker note**

“The central rule is deliberately not first-come-first-served. A Slot can have
several proposals and the owning centre chooses the one that best fits its
context — the same rule for a hospital, a residence or a palliative unit.”

---

## Slide 4 — MVP scope: depth before breadth

**Suggested time:** 0:50

**Bullets**

| Block | Scope | Status at this evidence cut-off |
| --- | --- | --- |
| 1. Core | Onboarding, Slot/Proposal coordination, Event publication, public browsing. | Implemented end to end, deployed, and covered by executed tests. Production hardening pending. |
| 2. Rating | One rating per Patient/Family account and completed Event. | Planned. |
| 3. Patronage | Simulated campaigns behind a `PaymentGateway` port. | Planned; no real payments. |

- No EHR integration, native mobile app, real payments, Kubernetes, or AWS in the MVP.
- **Six centre types (`widen-beyond-hospitals`, D16–D20):** implemented and
  verified locally against real PostgreSQL, demonstrable in the seeded `dev`
  environment; **not yet merged or deployed**, Basque copy pending native review.

**Speaker note**

“The scope is intentionally sequential. A complete, demonstrable core is more
defensible than several partially built modules. Real payments are explicitly
out of scope; the future block models only a simulated adapter boundary. The
generalisation from hospitals to six centre types is implemented and verified
locally; be explicit that it is demonstrable in the seeded environment, not yet
live in production.”

---

## Slide 5 — Technology choices and their rationale

**Suggested time:** 0:55

**Bullets**

- Next.js, TypeScript and Tailwind: one web repository with typed delivery and UI.
- PostgreSQL + Prisma: transactional persistence; adapters implemented and verified against real PostgreSQL in CI.
- Vitest + Playwright: unit, integration and E2E strategy, all three executing in CI.
- Vercel + managed PostgreSQL: deployed and live.
- **Monolith over microservices:** fewer distributed failure modes and less infrastructure without a current need.
- **DB-backed sessions over JWT:** immediate revocation after profile rejection/deactivation.

**Visual**

- A compact “decision / rejected alternative / reason” table.

**Speaker note**

“The project chooses intentional simplicity. Microservices or Kubernetes would
add deployment and observability complexity without improving this core
workflow. Sessions are chosen because governance requires revocation, not
because JWT is inherently wrong.”

---

## Slide 6 — Hexagonal architecture in a single repository

**Suggested time:** 0:55

**Bullets**

- `domain/`: framework-free entities, state machines, pure rules.
- `application/`: use cases and ports; orchestrates the domain.
- `infrastructure/`: Prisma repositories, three transactional units of work, sessions, hashing, rate limiting and HTTP adapters.
- `ui/` and `app/`: presentation plus thin Next.js entry points — 5 public pages, 3 role areas, 11 mutating API routes.
- Dependencies point inward; domain/application do not import Next.js or Prisma — enforced by ESLint and green in CI.
- **Role and kind are orthogonal axes (D16–D20, the gradable claim):** a single
  generic `centre` role answers "what may this account do?"; a separate
  `CentreType` enum answers "what kind of place is this?". Authorization never
  branches on the six types. **Adding a seventh centre type is data, not code** —
  one enum value + one migration `ADD VALUE` + one i18n label per locale, and
  zero changes to guards, the security predicate or the public read path. Proven
  by an integration test where all six types register → validate → publish a
  Slot through the identical guard path.

**Visual**

```text
UI / Next.js  →  Application (use cases + ports)  →  Domain
                      ↑
              Infrastructure adapters

role axis:  admin | centre | artist | patient      (authorization)
kind axis:  CentreType = hospital | nursing_home | day_centre |
            day_hospital | occupational_centre | palliative_unit   (data)
```

**Speaker note**

“The architectural test is simple: business rules must still be testable if we
replace Prisma or the delivery framework. Ports express what the application
needs; adapters decide how it is persisted or delivered. The strongest gradable
claim of the project lives here: because role and centre type are separate axes,
widening from one kind of centre to six touched the data axis and the copy, but
not the authorization surface — the security predicate stayed a single renamed
literal, `type: "CENTRE"`, never a six-value list.”

---

## Slide 7 — Domain model: explicit state machines

**Suggested time:** 1:00

**Bullets**

- `Profile`: `pending → active | rejected`; `active → deactivated`; `rejected → pending`.
- `Slot`: `open → filled | closed`.
- `Proposal`: `submitted → accepted | rejected`.
- `Event`: `created → published → completed`.
- Factories enforce initial state; transitions reject illegal changes.
- Domain rules are implemented and unit-tested without framework or database dependencies.

**Visual**

- Four small state diagrams rather than a dense class diagram.

**Speaker note**

“Explicit states make invalid paths visible. For example, a terminal Proposal
cannot be accepted again, and a non-active Profile cannot perform its role
actions. The `completed` Event state is a deliberate seam for Block 2.”

---

## Slide 8 — Critical invariant: accept one Proposal, resolve the entire Slot

**Suggested time:** 1:10

**Bullets**

- Preconditions: active owning Hospital, open Slot, matching submitted Proposal.
- One pure operation produces four outcomes:
  - selected Proposal → `accepted`;
  - Slot → `filled`;
  - every rival submitted Proposal → `rejected`;
  - new Event → `published`.
- Closing a Slot similarly rejects every submitted Proposal.
- Concurrency design: `withLockedSlot` locks first, reads live data inside the
  transaction, decides, persists, then commits.

**Visual**

```text
lock Slot first → reload Slot + all Proposals → pure decision → atomic persistence
```

**Speaker note**

“The key insight came from an adversarial review: locking after a decision is
too late. A concurrent submission could otherwise survive on a filled Slot. The
contract is implemented as `SELECT … FOR UPDATE` on the Slot row before any
decision-informing read, and it is proven — nine race scenarios are forced with
explicit barriers in both orderings and execute against real PostgreSQL in CI,
not against in-memory fakes.”

---

## Slide 9 — Development process: Spec-Driven Development

**Suggested time:** 0:45

**Bullets**

```text
Proposal → behaviour specifications → design / ADRs → task plan
         → layer-by-layer implementation → verification → review
```

- Proposal defines problem, scope and success criteria.
- Specifications use concrete Given/When/Then scenarios.
- ADRs turn requirements into technical decisions and rejected alternatives.
- Tasks provide traceability from design to implementation and verification.

**Speaker note**

“The specification is not documentation written at the end. It is the contract
used to decide what must be implemented and, equally important, what must not
be claimed yet.”

---

## Slide 10 — AI as a directed engineering tool

**Suggested time:** 0:40

**Bullets**

- AI work is constrained by specifications, scope boundaries and layer rules.
- Different roles are used for implementation and independent adversarial review.
- Human judgement owns requirements, trade-offs, acceptance and final responsibility.
- Artefacts, tests and review reports make the process inspectable.

**Visual**

- “Human decision → bounded AI task → code/review artefact → human validation.”

**Speaker note**

“The value of AI is acceleration with constraints, not automatic correctness.
The project treats generated output as an input to a reviewable engineering
process, rather than evidence on its own.”

---

## Slide 11 — Adversarial review: evidence of rigor, not just happy paths

**Suggested time:** 1:05

**Bullets**

- Planning review found a stale-read concurrency race.
  - Result: lock-first `MatchingUnitOfWork` design.
- Domain review found missing persistence support for `DEACTIVATED` and
  re-registration traceability.
  - Result: schema/migration delivered; migration applies to an empty database in CI.
- Application review found that a TypeScript allow-list is not runtime redaction
  and that re-registration lacked credential proof.
  - Result: a runtime field-by-field DTO with an HTTP no-leak test, and
    password-verified re-registration — both closed with executed evidence.
- Review reports preserve both findings and evidence status.
- Findings that remain open are still recorded as open: the aggregate status
  matrix, Profile/Proposal text bounds, and production hardening.

**Visual**

- Timeline: “finding → design correction → verification gate”.

**Speaker note**

“This is a central differentiator of the project. The review process does not
hide defects. It turns them into explicit design changes or release gates. Two
security issues remain open in the reviewed application and are not presented
as solved.”

---

## Slide 12 — Quality strategy: tests where the risk is

**Suggested time:** 0:55

**Bullets**

- Domain unit tests: states, factories, ownership, cascades and illegal transitions.
- Application unit tests: roles, live-profile checks, use-case orchestration and port contracts.
- Integration tests: PostgreSQL transactions, locks, partial indexes and session adapter — 17 files, serial, **executed in CI**.
- E2E tests: public browsing, the complete demo chain and the authorisation denial matrix — 12 tests, **executed in CI**.
- Headline evidence: **360 passed / 0 skipped** plus **12 Playwright tests passed**, on revision `482aefd`.
- No coverage percentage or production claim is made in this presentation without a reproducible execution record.

**Visual**

- Test pyramid with the executed counts per level and the dated CI run identifier.

**Speaker note**

“Selective strict TDD focuses on the most valuable rules: state transitions and
business invariants. In-memory doubles prove orchestration but cannot prove a row
lock or a database rollback — which is exactly why the concurrency evidence comes
from real PostgreSQL in CI rather than from fakes. Locally these race tests are
skipped by default and are flaky against a remote database because of network
latency; CI with a local PostgreSQL service is the authoritative record.”

---

## Slide 13 — Security by design: minimise the public and privileged surfaces

**Suggested time:** 1:10

**Bullets**

- OWASP threat model: access control, sessions, CSRF, injection, integrity,
  logging, configuration and supply chain.
- Public event output is limited to: title, description, date/time, duration and
  artist display name.
- Public centre directory adds the coarse centre type (`centreType`, D19) to
  name/city/postal/coordinates — never the address, email or internal `type`,
  and never a finer sub-label than the six-value category.
- Always excluded: room/ward, proposal message, email and internal IDs.
- **Accepted, documented, demo-scoped risk (T-22):** widening onboarding to
  residencias, disability day/occupational centres and palliative units raises
  the safeguarding bar (vulnerable adults, possible cognitive impairment) while
  verification stays self-declared with admin validation. Real institutional
  verification is named as the next follow-on, not implemented here — and not
  overstated as a control that exists.
- Server-side role, ownership, profile-type and live-status checks protect every mutation — re-read inside the mutation's own transaction.
- Session lifecycle implemented and verified: argon2id with pinned parameters, revocable DB sessions storing only the token hash, fresh token per login, idle/absolute expiry, and atomic rate limiting.
- CSRF enforced on all 11 mutating routes, including login; fails closed if `APP_ORIGIN` is unset.
- Hospital-context minimisation: no clinical data; location and private messages
  are treated as confidential.
- **Still open and stated as such:** no security headers, no CSP, no logging, no dependency scanning.

**Visual**

- “Public allow-list” box next to “never expose” box; a third box listing the open hardening items.

**Speaker note**

“Security is both architecture and implementation. The controls an earlier
revision of the threat model called pending — the runtime public DTO, CSRF on
every route, the session adapter, atomic rate limiting — are now integrated and
each one cites a test that executed. What is deliberately *not* claimed is
production hardening: this deployment has no security headers, no CSP, no
logging and no dependency scanning. It is a defensible MVP, not an
Internet-ready service, and the threat model says so control by control.”

---

## Slide 14 — Demonstration scenario: the end-to-end story to show

**Suggested time:** 1:00

**Bullets**

1. Admin activates a Hospital and an Artist profile.
2. Active Hospital publishes a future Slot.
3. Active Artist submits a Proposal; a second Artist may compete.
4. Owning Hospital accepts one Proposal.
5. The system fills the Slot, rejects rivals and publishes an Event.
6. An anonymous visitor sees only the public Event projection.

**Visual**

- Six-step live-demo checklist; display the expected state after each step.

**Speaker note**

“This chain is not aspirational: `e2e/demo-chain.spec.ts` automates exactly these
six steps and passed in CI against real PostgreSQL and seeded data, and a
companion test asserts that the public response contains only the five allowed
fields. The live demo shows the same chain against the deployed URL with
fictional seed data.”

> **TODO (autor):** decide how to run the demo on the day. The chain is proven in
> CI against a local PostgreSQL, but no run has been recorded against the
> *deployed* URL (tasks 7.7/7.8). Either record one beforehand and show it as
> evidence, or perform the demo live and be explicit that CI is the reproducible
> record. Do not imply a production smoke run happened if it did not.

---

## Slide 15 — Honest project status

**Suggested time:** 0:55

**Bullets**

| Implemented, and proven by an executed test | Implemented, not yet hardened | Planned |
| --- | --- | --- |
| Domain state machines and cascades; application ports, use cases and guards; Prisma repositories, migrations, row locks and partial indexes; session adapter; CSRF on every mutation; atomic rate limiter; runtime public allow-list; UI and API routes; integration and E2E suites; deployment serving seeded data. | Security response headers and CSP; request schema and body-size validation; environment validation at startup; security logging and alerting; dependency scanning. Aggregate status matrix and Profile/Proposal text bounds also remain open. | Block 2 ratings, Block 3 simulated patronage, enriched public experience. |

- Evidence: CI run 29905717933 on `482aefd` — 360 passed / 0 skipped, plus 12 Playwright tests.
- Live: <https://webmaster-lemon.vercel.app> (hospital-only baseline).
- Six-centre-type generalisation (`widen-beyond-hospitals`, D16–D20):
  **implemented and verified locally** against real PostgreSQL (628 passed /
  77 skipped on the feature branch), **not yet merged or deployed**; Basque copy
  a draft pending native review. Present it as demonstrable in the seeded
  environment, not as live in production.

**Speaker note**

“This slide is deliberately explicit, and the middle column is the honest one. A
defensible TFM does not convert a design decision into a production guarantee —
but it also should not undersell evidence that exists. The core is deployed and
its concurrency, authorisation and data-minimisation properties are proven by
tests that ran. The next milestone is hardening and observability, not feature
scope.”

> **TODO (autor):** the repository is currently private. If it is still private
> at the defence, say so plainly on this slide rather than letting the tribunal
> discover it — a stated limitation reads as rigour, a discovered one does not.

---

## Slide 16 — Future work after a secure core

**Suggested time:** 0:40

**Bullets**

- Harden Block 1: security headers and CSP, request validation, security logging, dependency scanning.
- Block 2: ratings only after `Event.completed`, with one rating per account/event.
- Block 3: simulated patronage through `PaymentGateway`; real payment processing
  requires a separate legal, privacy, fraud and financial threat model.
- Improve public browsing with accessibility information and non-sensitive filters.
- Add operational controls: monitoring, incident response, retention/deletion and dependency governance.

**Speaker note**

“The architecture leaves extension points, but extension is not a licence to
skip security. Payments, external integrations and richer patient-facing
features each require their own threat modelling before implementation.”

---

## Slide 17 — Conclusions and lessons learned

**Suggested time:** 0:45

**Bullets**

- A social problem can be addressed with a narrow, testable and deployable core.
- Explicit domain states and invariants make business correctness reviewable.
- Hexagonal boundaries keep framework and persistence details replaceable.
- Concurrency and public data minimisation are first-class design concerns.
- SDD, tests and adversarial review turn AI-assisted work into inspectable engineering.
- Final conclusion: the project is strongest when it states evidence and open
  risks with the same precision as completed features.

**Visual**

- One closing sentence: “A safe coordination core before feature breadth.”

**Speaker note**

“The main learning is not a framework choice. It is the discipline of treating
business rules, security constraints and verification evidence as part of the
product. Questions are welcome.”

## Presenter checklist before the defence

- Replace placeholders on Slide 1 with author, Master’s programme, supervisor and date.
- Add academic references on arts/humanisation in hospitals; do not make empirical claims without them.
- Re-run `npm run test` and check the latest CI run before the defence; if the
  numbers on Slides 12 and 15 have moved, update them rather than quoting these.
- Confirm the deployed URL is still live on the morning of the defence.
- Rehearse the live-demo fallback: a recorded demonstration is useful, but it
  must be identified as recorded and match the deployed revision.
- Keep technical identifiers in speaker notes where possible; the oral message
  should explain the decision and the evidence, not recite source code.

## Source artefacts

- [`docs/memoria-tfm-borrador.md`](memoria-tfm-borrador.md)
- [`docs/security-threat-model.md`](security-threat-model.md)
- [`proposal.md`](../openspec/changes/bootstrap-vivetutiempo-platform/proposal.md)
- [`design.md`](../openspec/changes/bootstrap-vivetutiempo-platform/design.md)
- [Specifications](../openspec/changes/bootstrap-vivetutiempo-platform/specs/)
- [Adversarial reviews](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/)
- [`src/domain/`](../src/domain/) and [`src/application/`](../src/application/)
