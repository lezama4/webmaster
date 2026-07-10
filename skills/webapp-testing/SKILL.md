---
name: webapp-testing
description: "Trigger: webapp testing, Playwright, local server, browser verification. Test WEB MASTER web apps safely."
license: Apache-2.0
metadata:
  author: ComposioHQ, adapted by koldobika
  version: "1.0"
---

## Activation Contract

Use this skill when validating WEB MASTER web applications in a browser, especially local development servers, Playwright checks, login flows, forms, navigation, responsive behavior, and regressions.

## Hard Rules

- Follow `AGENTS.md` and `skills/web-project-standards/SKILL.md` first.
- Prefer existing project test commands before inventing new ones.
- Start and stop local servers deliberately; do not leave orphan processes.
- Verify the app from the user's perspective, not only by checking build success.
- Do not hit production services unless the user explicitly asks and credentials/safety are clear.

## Decision Gates

| Situation | Required action |
|---|---|
| No app scaffold exists | Report that testing cannot run yet. |
| Local server command is unknown | Inspect package scripts or project docs first. |
| Auth/payment/external API flow | Use safe test data and call out security risks. |
| Visual or responsive change | Test at desktop and mobile viewport sizes. |
| Failing test | Capture the failing step, likely cause, and next fix. |

## Execution Steps

1. Identify the app framework, package manager, and available test/dev scripts.
2. Read `references/source-skill.md` if a deeper Playwright/server workflow is needed.
3. Run the smallest relevant validation: unit, integration, browser smoke, or E2E.
4. If browser testing is needed, start the dev server, wait for readiness, test, then shut it down.
5. Report commands run, result, failures, and remaining risks.

## Output Contract

Return tested scope, commands run, browser paths checked, failures found, and whether the local server was stopped.

## References

- `references/source-skill.md` — imported source from `ComposioHQ/awesome-codex-skills`.
