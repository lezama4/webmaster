# Vivetutiempo Security Threat Model and OWASP Analysis

## Scope, status, and method

This document is a design- and code-informed threat model for Vivetutiempo
Block 1. It is deliberately limited to the stable planning artefacts,
`src/domain/**`, `src/application/**`, and prior adversarial reviews. The
Prisma schema, migrations, `src/infrastructure/**`, infrastructure tests,
route handlers, and deployment configuration were **not read** because they
are under active construction. Controls assigned **Pending verification** are
therefore requirements for the infrastructure review, not claims about the
running system.

The model uses the current [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
as its primary taxonomy and cross-references the still widely used
[OWASP Top 10:2021](https://owasp.org/Top10/2021/). OWASP is an awareness and
prioritisation framework, not a certification; this document is not a legal,
penetration-testing, or compliance assessment.

Risk ratings are qualitative and assume an Internet-exposed MVP with no
production telemetry:

- **Impact:** effect on confidentiality, integrity, availability, patient and
  hospital trust, or operational safety.
- **Likelihood:** feasibility before the stated control is fully verified.
- **Control status:** **Implemented (reviewed layers only)**, **Designed**,
  **Partial/open gap**, **Pending verification**, or **Not currently
  applicable**. “Implemented” never means that cookies, database transactions,
  production configuration, or deployment behaviour have been verified.

The security-critical product decisions used in the analysis are DB-backed
cookie sessions (D1), lock-first matching (D4), an explicit public allow-list
(D6), session/CSRF hardening (D7), and schema additions needed for lifecycle
and sessions (D8) in
[`design.md`](../openspec/changes/bootstrap-vivetutiempo-platform/design.md).

## 1. Assets and data classification

The platform is not intended to process clinical records, diagnoses, treatment
data, or EHR integrations. Nevertheless, information is sensitive in its
hospital context: a room or ward may reveal where a vulnerable person is likely
to be, and a proposal or attendance pattern can reveal relationships and
operational details. “Fictional demo data” does not remove this threat if the
same architecture later processes live data.

| Asset / data set | Classification | Why it matters | Required handling |
| --- | --- | --- | --- |
| Public event projection: title, description, date/time, duration, artist display name | Public after publication; integrity-sensitive | It is intentionally anonymous-facing, but false or altered events damage trust and may cause attendance at the wrong time. | Explicit allow-list, published-only filter, output encoding, integrity-protected write path. |
| Exact Slot location, future schedule, Hospital identity and operational agenda | Confidential / context-sensitive | Ward, room and timetable information can expose operational or patient-adjacent context. | Never expose publicly; restrict to an active Artist with a legitimate need, and minimise logs. |
| Proposal message and competing-proposal state | Confidential | May contain direct contact details, commercial terms, personal information, or private operational context. | Hospital owner and authorised workflow only; no public projection; bounded and safely rendered. |
| Account email, profile name/type/status, account-to-profile relation | Personal data; confidential | Enables contact, account targeting, role inference, and governance decisions. | Server-side authorisation, data minimisation, retention policy, no unnecessary API disclosure. |
| Password plaintext, password hash, password-reset material if later added | Restricted credential data | Compromise permits account takeover at scale. | Never log plaintext; argon2id with current parameters; strong secret handling; no password echo. |
| Session bearer value, cookie attributes, session-token hash, session row | Restricted authentication data | A live bearer value is equivalent to an authenticated user. | CSPRNG token, store only token hash, `HttpOnly`/`Secure` cookie, expiry, revocation, CSRF protection. |
| Admin decisions, profile-review timestamp/history, security audit events | Confidential; integrity-critical | Evidence of governance and incident reconstruction. | Append-only or protected audit trail, access restriction, defined retention and redaction. |
| Login-limit records and client-address-derived value | Personal/security telemetry | Helps counter brute force but can itself become tracking data. | Store a truncated/hashed client key, short retention, no raw IP in application storage. |
| Database credentials, session secret, deployment variables, backups and logs | Restricted infrastructure data | Exposure can bypass all application controls. | Secret manager/environment controls, least privilege, redaction, backup access control. |

**Data prohibition.** The public API and registration/proposal forms must not
become channels for clinical data, patient names, room identifiers in free-text
descriptions, or emergency instructions. This is a product and validation
requirement, not merely a privacy notice.

## 2. Trust boundaries and attack surfaces

```text
Anonymous browser ── public event endpoint ─┐
                                             │
Authenticated browser + session cookie ─────┼── Next.js route handler / UI
Admin browser + session cookie ─────────────┘            │
                                                          ▼
                                             Application use cases and ports
                                                          │
                                                   trust boundary
                                                          ▼
                                     Infrastructure adapters / PostgreSQL / logs
                                                          │
                                                          ▼
                                             Backups and managed deployment
```

| Boundary / surface | Trust assumption that must be defended | Main abuse cases |
| --- | --- | --- |
| Anonymous public browsing | No caller identity is available and all returned bytes are public. | Data overexposure, enumeration, scraping, cache leakage, content abuse and denial of service. |
| Login, registration and logout | Input is hostile; the browser does not prove the claimed account or role. | Credential stuffing, account enumeration, registration abuse, session fixation, login CSRF. |
| Authenticated Hospital / Artist mutations | A session authenticates an account, not unlimited authority. Every request must derive role and current profile state server-side. | IDOR/BOLA, role escalation, acting after rejection/deactivation, cross-Hospital approval, duplicate submissions. |
| Administrator boundary | Admin actions change governance and can revoke access. | Compromised Admin account, CSRF, abusive deactivation/rejection, missing audit evidence. |
| Delivery layer to application layer | Route handlers must validate request data and turn a resolved session into a trusted `Actor`; application code must not trust body fields. | Client-supplied role/profile IDs, mass assignment, malformed input, error detail leakage. |
| Application to persistence/session adapters | Ports promise transactionality, locking and safe persistence but do not enforce those properties by themselves. | Stale reads, partial writes, unparameterised queries, plaintext session storage, non-atomic revocation. |
| Database, migrations, backups and logs | Data at rest and administrative tools are outside normal user authorisation. | Secret leakage, migration damage, backup exposure, raw-SQL mistakes, log disclosure. |
| Build and dependency supply chain | Dependencies and deployment artefacts execute with application privileges. | Vulnerable or compromised dependency, lockfile drift, unreviewed build configuration. |

No outbound URL-fetching, webhook consumer, EHR integration, file upload, or
payment gateway is present in the reviewed domain/application scope. SSRF is
therefore not a current application entry point, but it becomes in scope as soon
as any of those capabilities is introduced.

The hexagonal boundary reduces accidental framework/ORM imports in the domain
and application layers, as documented in
[`src/domain/README.md`](../src/domain/README.md) and
[`src/application/README.md`](../src/application/README.md). It is a
maintainability and testability control; it is not an authentication boundary
and cannot replace HTTP, database, or deployment security.

## 3. Actors and authorisation matrix

| Actor | Allowed in Block 1 | Explicitly prohibited / abuse to block |
| --- | --- | --- |
| Anonymous visitor | List published public events only. | See Slots, proposals, locations, emails, IDs, pending/closed data, or make mutations. |
| Patient / Family account | In Block 1, no privilege beyond public browsing; a seeded account demonstrates the role. | Hospital/Artist/Admin mutations. Rating is Block 2 only. |
| Artist with pending/rejected/deactivated Profile | May authenticate only if product policy permits it, but must have no role action. | List open slots or submit a proposal. |
| Active Artist | List future open Slots and submit one `submitted` Proposal per Slot. | Create Slots; approve/reject/close; read other Artists’ private proposals; submit duplicates. |
| Hospital with pending/rejected/deactivated Profile | Must have no Hospital action. | Publish, approve, reject, or close a Slot, including use of a pre-existing session. |
| Active Hospital | Publish and close its own Slots; approve/reject a Proposal belonging to its own Slot. | Decide another Hospital’s Slot, approve a mismatched Proposal/Slot, or perform Admin validation. |
| Admin | Approve/reject pending profiles and deactivate active Hospital/Artist profiles. | Approve/reject proposals or operate Hospital Slots merely because of Admin role. |
| External attacker / compromised account | No legitimate privilege. | Exploit endpoints, session tokens, errors, races, configuration, dependencies, or public data. |

The reviewed use cases include role and active-profile guards, Slot ownership
checks, and Proposal-to-Slot linkage checks. See
[`shared/guards.ts`](../src/application/use-cases/shared/guards.ts) and the
coordination specification’s ownership scenarios
([`slot-proposal-coordination/spec.md`](../openspec/changes/bootstrap-vivetutiempo-platform/specs/slot-proposal-coordination/spec.md)).
The conversion from HTTP request and cookie to `Actor` has not been reviewed;
therefore it remains a critical unverified boundary.

## 4. Threat register

### 4.1 Access control, public data, and workflow integrity

| ID | OWASP mapping | Asset affected | Vector | Impact | Likelihood | Expected control and status |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 Cross-tenant Slot/Proposal decision (IDOR/BOLA) | A01:2025 / A01:2021 Broken Access Control | Slots, proposals, events, Hospital trust | A Hospital changes a Slot ID or Proposal ID to approve, reject, or close another Hospital’s resource. | High integrity and confidentiality impact. | Medium | `assertRole`, active-profile checks, ownership check, and target Proposal/Slot linkage are **Implemented (reviewed application)**. The route handler must derive `Actor` from the session and never accept role/profile ID from the body: **Pending verification**. |
| T-02 Stale authority after rejection/deactivation | A01:2025 / A07:2025; A01/A07:2021 | Governance decisions, Slots, events | Admin changes Profile status after the actor’s initial profile read but before a Slot mutation commits. | High integrity impact; a removed Hospital can still decide an event. | Medium | The application performs a live profile read before the Slot unit of work: **Partial/open gap**. Prior review `pr2a-M1` shows this is not atomic with the Slot mutation. Require a transaction-scoped live status check with documented lock order and barrier tests. |
| T-03 Role/Profile type confusion | A01:2025 / A01:2021 | Slot ownership and role separation | Corrupt/imported state pairs a Hospital `Actor` with an active Artist Profile; current guard checks status but not matching profile type. | Medium integrity impact. | Low to medium | Role gate and active status are **Implemented (reviewed application)**; role-to-profile-type consistency is **Partial/open gap** (`pr2a-N1`). Require `Profile.type` to match the action role. |
| T-04 Public projection data leak | A01:2025, A06:2025 / A01, A04:2021 | Location, proposal message, emails, internal IDs | Infrastructure query or future refactor attaches extra runtime properties; `listPublishedEvents` returns the port object unchanged and JSON serialises extras. | High confidentiality and contextual-safety impact. | High once public endpoint exists | D6 and the public spec require a five-field allow-list: **Designed**. Current use case is **Partial/open gap**; `pr2a-B1` demonstrates that TypeScript typing is not runtime redaction. Build a fresh DTO field-by-field, add hostile-adapter and HTTP no-leak tests, and use a published-only query. |
| T-05 Non-public workflow disclosure | A01:2025 / A01:2021 | Unpublished Slots, proposal state/messages, profile status | Generic repository response, cache, error, or list endpoint exposes submitted/rejected content. | High confidentiality impact. | Medium | Specification explicitly excludes non-published items and forbidden fields: **Designed**. Endpoint query, cache directives, response schemas and integration tests are **Pending verification**. |
| T-06 Matching race produces contradictory state | A08:2025, A06:2025 / A08, A04:2021 | Slot/Proposal/Event consistency | Concurrent submit, approve, reject or close runs against stale data and leaves an actionable proposal on a non-open Slot or more than one accepted proposal. | High integrity impact. | Medium to high | Domain cascade and application use of `withLockedSlot` are **Implemented (reviewed layers)**. Actual `SELECT … FOR UPDATE`, complete in-lock reads, rollback and partial unique indexes are **Pending verification** in infrastructure. Barrier-based PostgreSQL tests are mandatory. |
| T-07 Incomplete persisted aggregate accepted as valid | A08:2025, A06:2025 / A08, A04:2021 | Historical integrity and future decisions | A corrupted or faulty persistence snapshot has a filled Slot with no accepted Proposal, multiple accepted Proposals, or submitted Proposals on a non-open Slot. | High integrity/audit impact. | Medium | `assertValidSlotAggregate` checks linkage, duplicate IDs, and only one `open`-with-accepted contradiction: **Partial/open gap**. `codex-pr1-review.md` M1 requires a full Slot/Proposal status matrix and negative rehydration tests. |
| T-08 Account/Profile partial registration or duplicate race | A08:2025, A10:2025 / A08:2021 | Account/profile consistency, onboarding availability | Account save succeeds but Profile save fails; or concurrent same-email registration observes no account twice. | Medium integrity and availability impact. | Medium | Domain factories are **Implemented**, but registration performs separate repository writes: **Partial/open gap** (`pr2a-M5`). Require an Account/Profile transaction, uniqueness-to-`ConflictError` mapping, and failure/concurrency tests. |

### 4.2 Authentication, sessions, and request forgery

| ID | OWASP mapping | Asset affected | Vector | Impact | Likelihood | Expected control and status |
| --- | --- | --- | --- | --- | --- | --- |
| T-09 Re-registration without proving account control | A07:2025 / A07:2021 Authentication Failures | Profile lifecycle, Admin review queue | An attacker who knows a rejected Hospital/Artist email triggers `rejected → pending`; the current existing-account branch ignores the supplied password. | High governance and account-integrity impact. | Medium | Same-Profile re-registration and audit timestamp are **Implemented in domain / Designed in schema**. Credential verification, role match and an atomic flow are **Partial/open gaps** (`pr2a-B2`). Require password verification or a separately verified recovery flow before reactivation. |
| T-10 Credential stuffing, brute force, and account enumeration | A07:2025 / A07:2021 | Accounts and availability | Repeated login attempts, distributed attacks, or timing comparison between unknown-email and wrong-password paths. | High account compromise impact. | High on a public login endpoint | Generic message and `LoginRateLimiter` port are **Implemented (reviewed application)**. `login` passes only email, not the designed client hash, and unknown accounts skip password verification: **Partial/open gap** (`pr2a-M2`). Require trusted client context, shared atomic limits, a dummy argon2id verification for unknown accounts, generic response, short telemetry retention, and tests. |
| T-11 Session theft, fixation, expiry or failed revocation | A04:2025, A07:2025 / A02, A07:2021 | Authenticated identity and all role actions | XSS, network/configuration error, database leak, session fixation, stale cookie, logout/deactivation race. | Critical impact. | Medium | D1/D7 require `HttpOnly`, `Secure`, `SameSite=Lax`, fresh CSPRNG ID on login, token-hash storage, absolute/idle expiry, logout deletion and revoke-all. Session port/profile unit-of-work contracts are **Implemented (reviewed application interfaces and orchestration)**. Cookie creation, CSPRNG, hashing, expiry enforcement, `touch`, database deletion and transactional guarantees are **Pending verification**. |
| T-12 Login/deactivation race | A01:2025, A07:2025, A08:2025 / A01, A07, A08:2021 | Session validity and revoked privileges | Login and deactivation interleave; a session is issued after or concurrently with deactivation. | High integrity impact. | Medium | `ProfileUnitOfWork.withLockedProfile` is **Designed/implemented as a port contract** and use cases call it. The reviewed fake covers only deactivation-first ordering: **Partial/open gap** (`pr2a-M3`, `pr2a-M4`). Verify both linearisation orders and final session state against PostgreSQL. |
| T-13 CSRF on login or authenticated mutations | A01:2025 / A01:2021 | Sessions, Slots, profile governance | A hostile site causes a victim’s browser to POST login, publish, approve, reject, close, validate, or deactivate using cookies. | High integrity impact. | Medium | D7 defines canonical configured-origin validation, `Referer` fallback, fail-closed behaviour, no mutation over GET, and login in scope: **Designed**. HTTP implementation, proxy handling and negative tests are **Pending verification**. SameSite alone is insufficient. |

### 4.3 Input handling, configuration, operational security, and resilience

| ID | OWASP mapping | Asset affected | Vector | Impact | Likelihood | Expected control and status |
| --- | --- | --- | --- | --- | --- | --- |
| T-14 SQL injection or unsafe migration execution | A05:2025 / A03:2021 Injection | Database integrity/confidentiality | Dynamic SQL in repositories or misapplied raw SQL for the required partial indexes. | Critical impact. | Low to medium | The intended partial-index SQL is static migration material, not user input: **Designed**. Parameterisation of all runtime queries, exact identifier/enumeration correctness, least-privilege DB account, migration review, and empty-schema test are **Pending verification**. Prior plan review B1 identified an identifier mismatch risk. |
| T-15 Stored XSS, oversized content, and rendering abuse | A05:2025, A10:2025 / A03, A05:2021 | Visitor browser, database/log availability, public trust | User-controlled Slot title/description, Profile name, or Proposal message is rendered as HTML, logged unsafely, or made arbitrarily large. | High impact if script executes; medium availability impact. | Medium | Slot fields have domain bounds: **Implemented (reviewed domain)**. Profile name and Proposal message are unbounded in the reviewed domain: **Partial/open gap** (`codex-pr1-review.md` M2). Require server request-size limits, normalisation and bounds, text-only rendering/no unsafe HTML, output encoding, CSP, and log encoding. |
| T-16 Security misconfiguration and secret exposure | A02:2025 / A05:2021 | Secrets, database, sessions, HTTP responses | Weak/placeholder session secret, debug mode, permissive headers/CORS, exposed `.env`, TLS/HSTS gaps, publicly reachable local database, or trusted-host mistakes. | Critical impact. | Medium | D7's canonical origin is **Designed**. Environment validation, secret management, TLS, headers, cookie flags, CORS, production-safe errors and database networking are **Pending verification**. Prior review identified `.env*` and local Compose exposure concerns; current infrastructure/configuration is intentionally out of scope here. |
| T-17 Dependency or build supply-chain compromise | A03:2025 / A06:2021 Vulnerable and Outdated Components | Entire application and deployment | Vulnerable or malicious dependency, lockfile drift, compromised CI/deployment credentials. | Critical impact. | Medium | No dependency/CI artefact was reviewed. SBOM or lockfile policy, automated vulnerability monitoring, dependency updates, protected deployment credentials and provenance checks are **Pending verification**. |
| T-18 Logging, alerting, and forensic gaps | A09:2025 / A09:2021 | Incident detection, privacy, governance evidence | Failed logins, authorisation denials, Admin actions, revocations or transaction failures are neither recorded nor actionable; alternatively logs record tokens/passwords/messages. | High detection and privacy impact. | Medium | No logging implementation was reviewed: **Pending verification**. Log security-relevant events with request/correlation ID, actor/account pseudonym where appropriate, outcome and reason code; never log passwords, session values, raw IPs, proposal text, exact locations, or full personal data. Define alerts and retention. |
| T-19 Unsafe exceptional-condition handling | A10:2025 / related A05/A09:2021 | Availability, data integrity, sensitive diagnostics | Failed adapter save, deadlock, unique violation, malformed request or dependency failure leaks a stack trace, retries unsafely, or leaves partial state. | High impact. | Medium | Application errors distinguish unauthenticated/forbidden/conflict/not-found: **Implemented (reviewed application)**. HTTP error mapping, transactional rollback, deadlock retry policy, idempotency decisions and safe production diagnostics are **Pending verification**. |
| T-20 SSRF and uncontrolled egress | A01:2025 (SSRF is included under access control) / A10:2021 SSRF | Internal network, cloud metadata, third-party credentials | Future URL preview, image fetch, webhook, EHR or payment integration fetches an attacker-controlled URL. | Critical if introduced. | Not currently applicable | No outbound fetch capability was observed in the permitted scope: **Not currently applicable**. Before any external integration, add URL allow-lists, DNS/IP revalidation, egress restrictions, timeouts, response-size limits, redirect controls and dedicated SSRF tests. |
| T-21 Privacy-retention and backup overcollection | A01/A02/A09:2025 / A01/A05/A09:2021 | Personal/context-sensitive data and backups | Indefinite storage of profiles, messages, client telemetry, logs or backups; deletion only from primary tables; public caches retain withdrawn data. | High privacy and trust impact. | Medium | The current artefacts specify minimisation but no approved retention/deletion schedule: **Pending product, legal and infrastructure decision**. See Section 6. |

## 5. OWASP Top 10 coverage map

OWASP Top 10:2025 changes category names and includes two new categories. The
following map keeps both versions visible so that the project can explain its
coverage to readers using either 2021 or 2025 terminology.

| OWASP Top 10:2025 | Related 2021 category | Vivetutiempo focus and required evidence |
| --- | --- | --- |
| A01 Broken Access Control | A01 Broken Access Control; 2021 A10 SSRF is now included here | Ownership of Slot decisions, role/profile checks, live status, public data projection, CSRF, and future SSRF controls. Test every denied role and cross-Hospital ID case at HTTP and application levels. |
| A02 Security Misconfiguration | A05 Security Misconfiguration | Production cookie/header/TLS/CORS/origin settings, secret validation, environment isolation, non-public database access, safe error mode. Verify deployment rather than relying on defaults. |
| A03 Software Supply Chain Failures | A06 Vulnerable and Outdated Components | Locked dependencies, SBOM/monitoring, security update process, CI and deployment credential protection. No evidence was reviewed yet. |
| A04 Cryptographic Failures | A02 Cryptographic Failures | Argon2id configuration, CSPRNG session values, token-hash-at-rest, TLS, secret rotation and no credential logging. Ports/design are insufficient until adapters are tested. |
| A05 Injection | A03 Injection | Prisma parameterisation, static reviewed raw migrations, request validation, output encoding, log encoding, and a ban on unsafe HTML rendering. |
| A06 Insecure Design | A04 Insecure Design | State machines, allow-list projection, re-registration proof of account control, abuse cases, concurrency model, retention decisions, and threat-model review before new integrations. |
| A07 Authentication Failures | A07 Identification and Authentication Failures | Database-backed session lifecycle, fixation prevention, expiry/revocation, rate limiting, timing-resistant login, CSRF on login, and protected password recovery if added. |
| A08 Software or Data Integrity Failures | A08 Software and Data Integrity Failures | Atomic account/profile registration, lock-first matching, partial unique indexes, transactional cascades, migration integrity, and secure build pipeline. |
| A09 Security Logging & Alerting Failures | A09 Security Logging and Monitoring Failures | Privacy-safe events, alerting, incident response and evidence for Admin/revocation actions. No implementation has been reviewed. |
| A10 Mishandling of Exceptional Conditions | Related to 2021 A05/A09 operational failure modes | Safe errors, rollback, conflict/unique violation mapping, deadlock handling, availability limits, and no leakage through diagnostics. |

The mapping follows the official [2025 list](https://owasp.org/Top10/2025/0x00_2025-Introduction/)
and the official [2021 list](https://owasp.org/Top10/2021/). In particular,
OWASP 2025 places CSRF and SSRF under Broken Access Control, reinforcing the
need to treat the public/API boundary as a first-class authorisation surface.

## 6. Privacy, minimisation, retention, and deletion requirements

This is a security model, not a legal determination. A data controller and
applicable jurisdiction must set the final privacy and retention policy before
production use. The following are minimum engineering requirements.

### 6.1 Minimisation and purpose limitation

1. Do not collect clinical, patient-identifying, diagnosis, treatment or
   emergency information. Make this prohibition visible in forms and
   moderation guidance.
2. Keep the public event projection to the specified five fields. In
   particular, do not publish room/ward, proposal message, email or database
   identifier, as required by
   [`public-event-browsing/spec.md`](../openspec/changes/bootstrap-vivetutiempo-platform/specs/public-event-browsing/spec.md).
3. Do not make exact Hospital locations available to anonymous users. Evaluate
   whether an active Artist needs exact location before a proposal is accepted;
   the current internal open-Slot listing includes it, so this is an explicit
   least-privilege decision to revisit.
4. Store the minimum data needed for account, governance and matching. A
   display name is not automatically public merely because it is stored.
5. Hash/truncate security telemetry such as client address and do not place
   messages, session IDs, credentials or locations in logs.

### 6.2 Retention and deletion design decisions still required

| Data class | Minimum requirement | Status |
| --- | --- | --- |
| Live sessions | Delete on logout/revoke; expire on absolute or idle expiry; clean expired rows. | Designed in D7; persistence behaviour pending verification. |
| Login-rate records | Use only short rolling-window retention; purge automatically; store no raw IP in application storage. | Designed in D7; exact duration and adapter pending. |
| Rejected/deactivated profiles | Define whether they are retained for governance/audit, anonymised after a period, or deleted on request subject to documented obligations. Re-registration traceability must not create indefinite data by accident. | Policy decision pending. |
| Proposals and messages | Define operational retention after rejection, closure and event completion. Messages should not survive indefinitely merely because they are convenient. | Policy decision pending. |
| Published events | Define correction/withdrawal behaviour, cache invalidation, and whether historical event data is anonymised. | Policy and HTTP-cache implementation pending. |
| Audit/security logs | Retain a minimised, access-controlled history for a defined period; separate security evidence from content data. | Policy and implementation pending. |
| Backups | Encrypt/access-control backups, set expiry, and document how deletion/anonymisation propagates or is honoured at restoration. | Infrastructure decision pending. |

Deletion workflows must be transactionally safe and auditable without retaining
the data that a deletion request was meant to remove. For example, an audit
record can retain a pseudonymous event and timestamp, but must not copy a
proposal message, password data, session bearer value, or exact location.

## 7. Infrastructure verification gate

When the concurrent infrastructure work is complete, a separate read-only
security review must verify at least the following before the MVP is exposed:

### Authentication, session, and CSRF

- Cookies are `HttpOnly`, `Secure` in production, appropriately scoped, and
  use the documented SameSite setting; no session token appears in HTML, URL,
  logs, or API JSON.
- Session values are CSPRNG-generated, only a one-way hash is persisted, and
  lookup compares safely enough for the implementation chosen.
- Absolute expiry, idle expiry and `touch` are enforced; logout/rejection/
  deactivation delete the intended rows; expired rows are cleaned up.
- Profile transition plus revoke-all and login profile check plus session
  creation are in the same database transaction/lock discipline.
- Login rate limits are shared and atomic across instances, use a trusted
  privacy-preserving client key, have cleanup, and return indistinguishable
  responses. Unknown-account and wrong-password paths should have equivalent
  password-verification work.
- Every mutation, including login, fails closed on missing/malformed/cross-site
  Origin/Referer and compares only to configured canonical origin(s), never
  attacker-supplied `Host`.

### Persistence, concurrency, and data exposure

- `withLockedSlot` locks the Slot row before any decision-informing read,
  loads the complete proposal set in the same transaction, persists all changes
  atomically, and rolls back on every failure.
- The partial unique indexes use the actual quoted Prisma/PostgreSQL
  identifiers and enum values. Database exceptions are mapped safely to
  conflicts without partial Slot/Proposal/Event state.
- Integration tests force both orderings of submit/approve/close/reject races,
  duplicate submissions, deactivation/login race, and storage failures.
- Profile lifecycle migration supports `DEACTIVATED` and review-request
  traceability; the migration applies to an empty database and has a safe
  rollout story.
- The public query selects only published events and only allowed columns.
  The application/route layer creates a fresh runtime DTO and tests that
  forbidden properties cannot reach JSON.

### HTTP, deployment, and operations

- Route handlers validate method, content type, schema, body size and IDs;
  derive identity solely from a verified session; return safe, stable error
  bodies; and disable mutation over GET.
- Output rendering uses text/encoded values rather than unsafe HTML. CSP,
  `frame-ancestors`, content-type, referrer, permissions and transport
  headers are chosen and tested in the actual Next.js deployment.
- Secrets are not committed, placeholders fail startup in production, the DB
  account has least privilege, network exposure is intentional, and backups
  are protected.
- Dependency scanning/update ownership, deployment access control, privacy-safe
  logging, alerting and incident-response procedures exist and are exercised.

## 8. Prioritised remediation order

1. **Do not publish a public endpoint** until T-04/T-05 are closed with a
   runtime allow-list mapper and HTTP no-leak test.
2. **Do not permit re-registration** until T-09 validates account control and
   role/profile consistency atomically.
3. **Do not rely on session revocation** until T-11/T-12 are verified against
   the real session and transaction adapter.
4. **Do not claim race safety** until T-06 is proven by deterministic
   PostgreSQL integration tests and database constraints.
5. Close T-10, T-13, T-15 and T-16 before any Internet-facing authentication or
   governance route is deployed.
6. Establish logging, retention, backup and supply-chain controls (T-17,
   T-18, T-21) before treating the MVP as operationally defensible.

## Source evidence

- [`design.md`](../openspec/changes/bootstrap-vivetutiempo-platform/design.md), ADRs D1, D4, D6, D7 and D8.
- [Profile onboarding specification](../openspec/changes/bootstrap-vivetutiempo-platform/specs/profile-onboarding/spec.md).
- [Slot and Proposal coordination specification](../openspec/changes/bootstrap-vivetutiempo-platform/specs/slot-proposal-coordination/spec.md).
- [Public event browsing specification](../openspec/changes/bootstrap-vivetutiempo-platform/specs/public-event-browsing/spec.md).
- [`src/domain/`](../src/domain/) and [`src/application/`](../src/application/) reviewed source.
- [Adversarial planning review](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-planning-review.md), [PR 1 review](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr1-review.md), [PR 2 plan review](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr2-plan-review.md), and [PR 2a review](../openspec/changes/bootstrap-vivetutiempo-platform/reviews/codex-pr2a-review.md).
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/) and [OWASP Top 10:2021](https://owasp.org/Top10/2021/).
