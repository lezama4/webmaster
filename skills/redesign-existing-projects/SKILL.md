---
name: redesign-existing-projects
description: "Trigger: redesign, UI audit, existing project polish. Improve an existing interface without breaking behavior."
license: MIT
metadata:
  author: Leonxlnx, adapted by koldobika
  version: "1.0"
---

## Activation Contract

Use this skill when WEB MASTER already has an interface and the task is to audit, redesign, or improve its visual quality without changing the product behavior unnecessarily.

## Hard Rules

- Preserve existing functionality, routes, data flow, and user intent.
- Do not migrate frameworks, styling systems, or component libraries just to improve visuals.
- Prefer focused, reviewable improvements over large rewrites.
- Check current dependencies before adding animation, icon, or UI libraries.
- Keep accessibility and regression risk ahead of visual novelty.

## Decision Gates

| Situation | Required action |
|---|---|
| Existing UI feels generic | Audit typography, spacing, hierarchy, states, and layout before editing. |
| Redesign affects flows | Preserve navigation, validation, error handling, and back paths. |
| New dependency needed | Justify the tradeoff or avoid it. |
| Large visual rewrite | Split into reviewable work units. |

## Execution Steps

1. Inspect the current UI and identify the smallest high-impact fixes.
2. Read `references/source-skill.md` for the redesign priority model and anti-generic patterns.
3. Apply improvements in this order: typography, palette, states, layout, components, loading/empty/error states.
4. Test the affected flow after every meaningful change.
5. Report before/after intent and any behavior intentionally left unchanged.

## Output Contract

Return changed files, visual fixes made, behavior preserved, validation performed, and remaining redesign risks.

## References

- `references/source-skill.md` — imported source from `Leonxlnx/taste-skill`, MIT licensed.
