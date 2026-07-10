---
name: web-project-standards
description: "Trigger: WEB MASTER, web project standards, new feature, architecture review. Apply project-specific web delivery standards."
license: Apache-2.0
metadata:
  author: koldobika
  version: "1.0"
---

## Activation Contract

Use this skill when planning, creating, reviewing, or modifying substantial work in the WEB MASTER project.

## Hard Rules

- Follow the root `AGENTS.md` first.
- Keep code, identifiers, UI copy, commits, PRs, and technical docs in English unless the project already uses another language for that artifact.
- Prioritize security, maintainability, UX, performance, and simple architecture.
- Do not add dependencies, services, or infrastructure without a clear technical reason.
- Treat authentication, authorization, user data, payments, file uploads, and public APIs as security-sensitive.

## Decision Gates

| Situation | Required action |
|---|---|
| Ambiguous requirement | Ask one clarifying question before implementation. |
| New feature | Check architecture, security, UX, testing, and performance impact. |
| External dependency | Justify the tradeoff and maintenance cost. |
| Public endpoint or sensitive data | Run a security review before finalizing. |
| Multi-file implementation | Plan work units and validate with tests or explicit manual checks. |

## Execution Steps

1. Identify the affected layer: frontend, backend, data, infrastructure, or cross-cutting.
2. Define the minimal viable design before writing code.
3. Check security and data-flow risks.
4. Implement in small, reviewable units.
5. Add or update relevant tests.
6. Verify behavior and report remaining risks.

## Output Contract

Return changed files, validation performed, key decisions, and pending risks. Keep the answer concise unless the task needs deeper explanation.

## References

- `AGENTS.md` — project operating rules and web orchestration model.
