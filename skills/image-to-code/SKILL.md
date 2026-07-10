---
name: image-to-code
description: "Trigger: image to code, screenshot to UI, visual reference. Implement UI from reference images accurately."
license: MIT
metadata:
  author: Leonxlnx, adapted by koldobika
  version: "1.0"
---

## Activation Contract

Use this skill when WEB MASTER frontend work starts from a screenshot, mockup, generated comp, brand board, or other visual reference that must be translated into production UI.

## Hard Rules

- Analyze the image before coding; do not jump straight to components.
- Match layout, hierarchy, spacing, typography, color, and interaction intent, not just surface decoration.
- Preserve accessibility, responsive behavior, and existing project conventions.
- Use existing dependencies first; justify any new asset, font, icon, or animation library.
- Do not copy third-party brand assets unless the user has rights to use them.

## Decision Gates

| Situation | Required action |
|---|---|
| Reference is incomplete | State assumptions and ask only if the missing detail changes implementation risk. |
| Multiple screens exist | Derive shared components and tokens before page-specific code. |
| Image implies complex animation | Implement a simpler accessible version unless motion is a core requirement. |
| Asset rights are unclear | Use placeholders or user-provided assets only. |

## Execution Steps

1. Extract structure: sections, grid, spacing scale, typography, palette, assets, and states.
2. Read `references/source-skill.md` for the detailed image-to-code workflow.
3. Map visual elements to existing project components and styling primitives.
4. Implement responsive UI, then compare against the reference.
5. Verify accessibility, mobile layout, and performance.

## Output Contract

Return changed files, reference interpretation, implementation notes, validation performed, and any visual mismatches still pending.

## References

- `references/source-skill.md` — imported source from `Leonxlnx/taste-skill`, MIT licensed.
