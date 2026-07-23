# Project Memory Archive — Vivetutiempo (WEB MASTER)

> **Purpose**: Human-readable export of the Engram memory store for this project.
> Created after a hard-drive failure on the original development machine, where these
> records became the only surviving account of early product decisions.
>
> **Exported**: 2026-07-20
> **Source**: Engram SQLite store (`~/.engram/engram.db`), project `web master`, observations #267–#275
> **Original project path**: `C:\Users\koldobika\OneDrive - Berritzen\Documentos\WEB MASTER`
> **Current project path**: `C:\Koldo\Proyectos\WebMaster`
>
> ⚠️ **These records are historical.** They describe the project as of 2026-05-25, when no
> application stack existed yet. Several statements below (no test runner, no `package.json`,
> `openspec/` absent) were accurate then and are outdated now. They are preserved as written,
> not corrected. See "Known drift" at the end.

---

## Table of contents

| # | Type | Title | Date |
|---|---|---|---|
| [#267](#267--evaluated-composio-codex-skills-for-web-master) | decision | Evaluated Composio Codex skills | 2026-05-25 13:22 |
| [#268](#268--defined-hospital-events-portal-concept) | decision | Defined hospital events portal concept | 2026-05-25 13:27 |
| [#269](#269--discovered-spanish-hospital-arts-comparables) | discovery | Spanish hospital arts comparables | 2026-05-25 13:29 |
| [#270](#270--set-platform-as-free-non-profit-service) | decision | Free non-profit service | 2026-05-25 13:31 |
| [#271](#271--sdd-init-project-context) | architecture | SDD init project context | 2026-05-25 13:43 |
| [#272](#272--testing-capabilities) | config | Testing capabilities | 2026-05-25 13:43 |
| [#273](#273--skill-registry) | config | Skill registry | 2026-05-25 13:43 |
| [#274](#274--session-summary-sdd-init) | session | Session summary — SDD init | 2026-05-25 13:44 |
| [#275](#275--session-summary-project-kickoff) | session | Session summary — project kickoff | 2026-05-25 14:44 |

---

## #267 — Evaluated Composio Codex skills for WEB MASTER

- **Type**: decision · **Topic**: `workspace/composio-awesome-codex-skills-evaluation`
- **Created**: 2026-05-25 13:22:09
- **Note**: stored under Engram project `new project`, but concerns WEB MASTER.

**What**: Evaluated `ComposioHQ/awesome-codex-skills` and recommended not importing the whole repo into `WEB MASTER`; only `webapp-testing` is a strong project-local candidate, while most other skills are global/workflow-specific.

**Why**: The user asked whether the repo is useful for the WEB MASTER web project.

**Where**: Candidate project path `…\WEB MASTER\skills`; source `https://github.com/ComposioHQ/awesome-codex-skills`

**Learned**: The repo is a broad curated catalog for Codex workflows; `webapp-testing` adds practical Playwright/server-lifecycle guidance, `theme-factory` is more artifact/deck-oriented, `deploy-pipeline` is useful only if the project uses Stripe/Supabase/Vercel/Composio, and `create-plan` is redundant with existing AGENTS/SDD planning.

---

## #268 — Defined hospital events portal concept

- **Type**: decision · **Topic**: `product/core-concept`
- **Created**: 2026-05-25 13:27:49

**What**: Defined the core product concept as a web portal connecting hospitals, artists, and patrons to fill unused hospital time with scheduled events for patients and families.

**Why**: The project is intended as a final master's project in AI-assisted development and should demonstrate SDD, architecture, Clean Architecture, quality, and security.

**Where**: Product discovery conversation for WEB MASTER.

**Learned**: Key roles are hospitals offering agenda slots, artists applying to fill them, attendees voting after events to award reputation stars, and donors/patrons funding activities. Tax deductibility should be treated as a legal/compliance hypothesis, not promised blindly.

---

## #269 — Discovered Spanish hospital arts comparables

- **Type**: discovery · **Topic**: `product/market-landscape`
- **Created**: 2026-05-25 13:29:46

**What**: Found Spanish initiatives related to bringing art, music, exhibitions, and cultural activities into hospitals, but no exact equivalent discovered as a multi-sided portal combining hospital agenda slots, artist matching, public/private patronage, scheduling, voting, and reputation.

**Why**: The user asked whether something similar exists in Spain to position the master's final project realistically.

**Where**: Product discovery for WEB MASTER; sources include Músicos por la Salud, Cultura en Vena, Fundación [H]arte, Believe in Art, ShowTime en Planta, Comunidad de Madrid.

**Learned**: Existing initiatives are mostly foundation/program-led and vertical by activity type; the differentiator for the MVP should be platform orchestration, workflow, role-based governance, traceability, and compliance rather than merely "art in hospitals".

---

## #270 — Set platform as free non-profit service

- **Type**: decision · **Topic**: `product/business-model`
- **Created**: 2026-05-25 13:31:19

**What**: Defined the platform as totally free and not intended to generate profit.

**Why**: The user clarified the project goal is social impact for a master's final project, not a commercial marketplace.

**Where**: Product strategy for WEB MASTER.

**Learned**: The architecture and UX should avoid commission-based marketplace assumptions; donations/funding, if included, should be treated as transparent support for activities or the responsible non-profit entity, not revenue extraction.

---

## #271 — SDD Init Project Context

- **Type**: architecture · **Topic**: `sdd-init/web-master`
- **Created**: 2026-05-25 13:43:30

**Project**: web master
**Project path**: `C:\Users\koldobika\OneDrive - Berritzen\Documentos\WEB MASTER`
**Detected on**: 2026-05-25
**Artifact store mode**: engram
**OpenSpec**: not created; `openspec/` was absent after init.

### Product Context

- Provisional product name: Vivetutiempo.
- Final master web project using AI-assisted development.
- Free, non-profit social-impact platform.
- Multi-sided platform connecting hospitals, artists/activity providers, families/patients, patrons/donors, and admins.
- Hospitals publish available agenda slots.
- Artists/activity providers propose events for those slots.
- Hospitals/admins approve events.
- Attendees can rate completed events with stars.
- Donations/funding are transparent support, not platform revenue.
- Tax deductibility must be treated as a compliance/legal hypothesis, not promised without legal validation.

### Detected Repository State

- No application stack has been scaffolded yet.
- No `package.json`, lockfile, `tsconfig`, test config, CI workflow, `go.mod`, `pyproject.toml`, `Cargo.toml`, or `Makefile` detected.
- Existing project files are instruction/skill assets: `AGENTS.md`, `skills/`, `.atl/skill-registry.md`, `.gitignore`.

### Project Conventions

- Root `AGENTS.md` defines senior technical orchestration for web development.
- Code, identifiers, UI copy, technical docs, commits, and PRs default to English unless the user or project explicitly requires another artifact language.
- Substantial web work should cover functional analysis, architecture, security, UX/UI, technical design, implementation plan, testing strategy, performance, and final validation.
- Decision priorities: security, maintainability, UX, performance, scalability, operational cost.
- Default stack policy if no stack is specified: Next.js + TypeScript + Tailwind, Node.js + NestJS, PostgreSQL, JWT + OAuth, Docker/Kubernetes, AWS, Playwright + Vitest, GitHub Actions. This is a policy default, not a detected installed stack.

### SDD Init Result

- Persistence initialized in Engram mode.
- Local `openspec/` intentionally not created.
- Skill registry built at `…\WEB MASTER\.atl\skill-registry.md`.
- `.gitignore` includes `.atl/`.
- Testing capabilities persisted separately at topic key `sdd/web master/testing-capabilities`.

### Skill Resolution

- Project-specific skills available: `web-project-standards`, `design-taste-frontend`, `redesign-existing-projects`, `image-to-code`.
- Skill registry topic key: `skill-registry`.

### Strict TDD

- `strict_tdd: false` for now because no test runner exists yet.
- Re-run/update SDD init after scaffolding the application stack so test command, coverage, lint, typecheck, and formatter can be detected.

---

## #272 — Testing Capabilities

- **Type**: config · **Topic**: `sdd/web-master/testing-capabilities`
- **Created**: 2026-05-25 13:43:36

**Project**: web master
**Strict TDD Mode**: disabled
**strict_tdd**: false
**Detected**: 2026-05-25
**Reason**: no application stack or test runner is present yet.

### Test Runner

- Command: `—`
- Framework: none detected

### Test Layers

| Layer | Available | Tool |
| --- | --- | --- |
| Unit | ❌ | — |
| Integration | ❌ | — |
| E2E | ❌ | — |

### Coverage

- Available: ❌
- Command: `—`

### Quality Tools

| Tool | Available | Command |
| --- | --- | --- |
| Linter | ❌ | `—` |
| Type checker | ❌ | `—` |
| Formatter | ❌ | `—` |

### Detection Evidence

No `package.json`, lockfile, `tsconfig`, `vitest.config.*`, `jest.config.*`, `playwright.config.*`, ESLint/Prettier config, CI workflow, `go.mod`, `pyproject.toml`, `Cargo.toml`, or `Makefile` was detected in the project root.

### Next Update Trigger

After the application is scaffolded, update this artifact with actual commands, expected test layers, coverage, linter, type checker, and formatter. If a test runner exists then Strict TDD should become enabled by default unless a project marker explicitly disables it.

---

## #273 — Skill Registry

- **Type**: config · **Topic**: `skill-registry`
- **Created**: 2026-05-25 13:43:42

Generated: 2026-05-25
Project root: `C:\Users\koldobika\OneDrive - Berritzen\Documentos\WEB MASTER`
Local registry path: `…\WEB MASTER\.atl\skill-registry.md`

### Registry Contract

- This is an index only; each `SKILL.md` remains the source of truth.
- Delegators must pass exact `SKILL.md` paths to sub-agents.
- Sub-agents must read the passed `SKILL.md` files before work.
- Reserved skills skipped from the registry: `sdd-*`, `_shared`, and `skill-registry`.
- Duplicate names prefer project-level skills over user-level skills.

### Project Conventions

| File | Notes |
| --- | --- |
| `AGENTS.md` | Project instruction / convention source |
| `skills\web-project-standards\SKILL.md` | Referenced by project instructions |
| `skills\design-taste-frontend\SKILL.md` | Referenced by project instructions |
| `skills\redesign-existing-projects\SKILL.md` | Referenced by project instructions |
| `skills\image-to-code\SKILL.md` | Referenced by project instructions |

### Indexed Skills

| Skill | Trigger / description | Scope |
| --- | --- | --- |
| design-taste-frontend | Premium frontend, UI design, landing page, frontend polish | project |
| image-to-code | Image to code, screenshot to UI, visual reference | project |
| redesign-existing-projects | Redesign, UI audit, existing project polish | project |
| web-project-standards | WEB MASTER, web project standards, new feature, architecture review | project |
| branch-pr | Create Gentle AI pull requests with issue-first checks | user |
| chained-pr | PRs over 400 lines, stacked PRs, review slices | user |
| cognitive-doc-design | Guides, READMEs, RFCs, onboarding, architecture docs | user |
| comment-writer | PR feedback, issue replies, Slack/GitHub comments | user |
| go-testing | Go tests, coverage, Bubbletea teatest, golden files | user |
| imagegen | Generate or edit raster images | user |
| issue-creation | GitHub issues, bug reports, feature requests | user |
| judgment-day | Blind dual review, adversarial review | user |
| openai-docs | OpenAI product/API docs and citations | user |
| plugin-creator | Create and scaffold Codex plugin directories | user |
| skill-creator | New skills, agent instructions | user |
| skill-improver | Improve, audit, refactor skills | user |
| skill-installer | Install Codex skills | user |
| work-unit-commits | Commit splitting, chained PRs, reviewable work units | user |

### Scan Summary

- Indexed skills: 18.
- Project convention files: 1.
- Project-referenced skill paths: 4.
- Skipped reserved/duplicate skills: 57.
- Inaccessible sources: 0.

---

## #274 — Session summary: SDD init

- **Type**: session_summary · **Session**: `sdd-init-web-master-2026-05-25`
- **Created**: 2026-05-25 13:44:50

### Goal

Initialize SDD for the `web master` project in Engram mode without creating `openspec/`.

### Instructions

Use artifact store mode `engram`; do not create `openspec/`; always build `.atl/skill-registry.md`; persist SDD/config artifacts with `capture_prompt: false`.

### Discoveries

- The project currently has no scaffolded application stack or test runner; only `AGENTS.md` and project skills exist.
- `strict_tdd` is false until a real test runner is added.
- Product context is provisional name Vivetutiempo: free non-profit social-impact platform connecting hospitals, artists/activity providers, families/patients, patrons/donors, and admins.

### Accomplished

- ✅ Built `.atl/skill-registry.md` with 18 indexed skills and exact `SKILL.md` paths.
- ✅ Added `.atl/` to `.gitignore`.
- ✅ Persisted `sdd-init/web master`, `sdd/web master/testing-capabilities`, and `skill-registry` to Engram under project `web master` with `capture_prompt: false`.
- ✅ Verified `openspec/` remains absent.

### Next Steps

- Run `/sdd-new` or `/sdd-explore` for the first product change.
- Re-run/update testing capabilities after scaffolding the app stack.

---

## #275 — Session summary: project kickoff

- **Type**: session_summary · **Session**: `manual-save-web-master`
- **Created**: 2026-05-25 14:44:05

### Goal

Start the Vivetutiempo final master web project with SDD, product positioning, and project workflow initialization.

### Instructions

- User wants concise Spanish/Rioplatense replies and values honest pushback.
- Project artifacts should default to English; reply language follows the user.
- No AI attribution or Co-Authored-By in commits; use conventional commits.
- The project should be orchestrated via SDD and specialized agents per `AGENTS.md`.

### Discoveries

- Workspace initially contained only `AGENTS.md` and skills; no app stack existed yet.
- SDD was initialized in Engram mode by sub-agent Kant; no openspec directory was created.
- Strict TDD is currently disabled because there is no test runner/scaffolded app yet.
- Comparable Spanish initiatives exist for arts/music/culture in hospitals, but no exact multi-sided coordination platform was found.
- Tax deductibility for donations is legally conditional and must be treated as compliance, not a product promise.

### Accomplished

- ✅ Defined the product concept: Vivetutiempo, a free non-profit platform connecting hospitals, artists/activity providers, patients/families, donors/patrons, and admins.
- ✅ Clarified the MVP direction: master/demo project first, not real production rollout yet.
- ✅ Saved core product/workflow decisions to Engram.
- ✅ Ran SDD init in Engram mode; artifacts saved as Engram #271, #272, #273.
- ✅ Created local `.atl/skill-registry.md` and `.gitignore` with `.atl/`.
- 🔲 User agreed to use hybrid mode next so SDD artifacts are both persisted and available as deliverable files, but mode conversion has not been executed yet.
- 🔲 Need to ask/confirm SDD execution mode next time: interactive vs automatic.

### Next Steps

- Continue by switching/using SDD artifact store mode `hybrid` for the first real change.
- Ask the user to choose SDD execution mode if not already chosen: interactive or automatic.
- Start `/sdd-new` or `/sdd-ff` equivalent for the initial product/platform scaffold, likely `bootstrap-vivetutiempo-platform`.
- Because the app stack does not exist, plan scaffold first; after installing test tooling, update SDD init/testing capabilities so Strict TDD can activate.

---

## Known drift (as of 2026-07-20)

The records above stop at 2026-05-25. Development continued for roughly two months
without being captured in memory. The following statements are now outdated —
kept above verbatim as historical record, corrected here:

| Record | Said then | True now |
|---|---|---|
| #271, #272, #274, #275 | No application stack scaffolded | Next.js 16.2.10, React 19.2.4, Prisma 6.19, Tailwind 4, next-intl |
| #272 | No test runner; `strict_tdd: false` | Vitest 4 + Playwright 1.61 + GitHub Actions CI on Node 22 |
| #271, #274 | `openspec/` intentionally absent | `openspec/` directory exists in the repository |
| #271, #273 | Project root under OneDrive | Now `C:\Koldo\Proyectos\WebMaster` |
| #275 | Artifact store mode conversion to `hybrid` pending | Unverified — `openspec/` presence suggests it happened |

**Uncaptured period**: 2026-05-25 → 2026-07-12 (approx. last commit).
Product decisions made during implementation — the data model, the simulated
payments design, the i18n strategy, the "Sage clínico" visual direction — exist
only in the code and commit history, not in memory.

### Open work at time of export

| Branch | State |
|---|---|
| `feat/support-payments` | 3 commits; lead commit marked "[pending adversarial review]" |
| `feat/delivery-ui` | 1 commit; 1–5 star event ratings for registered users |
| `feat/application` | 0 commits ahead of `main` — merged or abandoned |

<!-- preview-db verification probe (2026-07-23) — remove after check -->
