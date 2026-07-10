---
name: design-taste-frontend
description: "Trigger: premium frontend, UI design, landing page, frontend polish. Apply Taste Skill frontend design rules."
license: MIT
metadata:
  author: Leonxlnx, adapted by koldobika
  version: "1.0"
---

## Activation Contract

Use this skill for WEB MASTER frontend work where visual quality, layout, typography, spacing, motion, and component polish materially affect the outcome.

## Hard Rules

- Follow `AGENTS.md` and `skills/web-project-standards/SKILL.md` first.
- Work with the existing framework, package manager, Tailwind version, and component system.
- Check dependency files before importing UI, animation, icon, or state libraries.
- Prioritize responsive layout, accessible interaction states, restrained motion, and strong visual hierarchy.
- Do not apply aesthetic rules blindly when they conflict with usability, brand direction, performance, or accessibility.

## Decision Gates

| Situation | Required action |
|---|---|
| Building a new interface | Use the Taste Skill reference for layout, typography, color, spacing, and motion guidance. |
| Adding animation | Verify performance impact and isolate client-only motion code. |
| Introducing icons/fonts/libraries | Check existing dependencies first and justify additions. |
| Brand direction is unclear | Ask one concise visual-direction question before heavy design work. |

## Execution Steps

1. Identify the page type, user goal, and primary conversion/action.
2. Read `references/source-skill.md` for detailed Taste Skill rules when designing or implementing UI.
3. Convert the rules into a minimal, project-appropriate design plan.
4. Implement polished responsive UI with loading, empty, error, hover, focus, and active states when relevant.
5. Verify accessibility, mobile layout, and performance-sensitive motion.

## Output Contract

Return changed files, validation performed, design decisions, dependencies checked, and remaining UX/performance risks.

## References

- `references/source-skill.md` — imported source from `Leonxlnx/taste-skill`, MIT licensed.
