# TFM defence deck

`../tfm-defense-deck.pptx` is the generated defence deck (17 slides, 16:9),
built from `generate-deck.js` and following the structure of
[`../slides-outline.md`](../slides-outline.md).

## Regenerate

```bash
npm install pptxgenjs   # once, in this folder or globally
node generate-deck.js   # writes tfm-defense-deck.pptx here
```

## Before the defence — author actions

The deck carries explicit `[AUTOR]` placeholders that only you can fill:

- **Slide 1** — your name, master's programme, academic year, supervisor.
- **Slide 12** — refresh the exact test/CI counts on the day of the defence.
- **Slide 14** — decide how the live demo runs (recorded vs. live).
- **Slide 15** — if the repository is still private at the defence, state it.

## Status reflected

Content is current as of 2026-07-27: the six centre types are merged and
deployed; Blocks 2 and 3 are merged; domain-integrity (PR #31) and security
hardening (PR #32) are implemented and in review. Adjust the "in review" wording
to "merged" on the status slides (4, 11, 13, 15) once those PRs land.

## Visual QA note

The deck passed structural validation (opens cleanly, 17 slides, correct 16:9
geometry, no shape crosses a slide boundary) and content QA. Pixel-level visual
QA (text-overflow / overlap) was **not** run in the authoring environment
because LibreOffice was unavailable there — give it one pass in PowerPoint and
nudge any tight text box before presenting.
