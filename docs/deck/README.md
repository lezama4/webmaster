# Presentation decks

Two decks, two audiences. Do not mix them up.

| File | Audience | Purpose |
|------|----------|---------|
| [`../tfm-pitch-deck.pptx`](../tfm-pitch-deck.pptx) | **Non-technical** | **Sell the idea.** This is the deck for the submission **Slides** field and the pitch video — no jargon, the human story of "Todo el tiempo cuenta". Generator: `generate-pitch-deck.js`. |
| [`../tfm-defense-deck.pptx`](../tfm-defense-deck.pptx) | Technical | The full technical / repository deck (17 slides): architecture, state machines, security, testing. Generator: `generate-deck.js`. |

Per the master's brief, the **technical explanation lives in the repository**
(the defence deck plus the docs), and the **Slides and video are the
non-technical pitch**. The video narration that matches the pitch deck is
[`../pitch-video-script.md`](../pitch-video-script.md).

## Regenerate

```bash
npm install pptxgenjs          # once, in this folder or globally
node generate-pitch-deck.js    # writes tfm-pitch-deck.pptx
node generate-deck.js          # writes tfm-defense-deck.pptx
```

## Before submitting — author actions

- **Pitch deck, slide 1** — replace `[AUTOR]` with your name / project line.
- Give the deck one visual pass in PowerPoint. Pixel-level visual QA (overflow /
  overlap) was **not** run in the authoring environment (no LibreOffice there);
  structural validation (opens cleanly, 16:9, no shape crosses a slide boundary)
  and content QA both passed.
- Host the `.pptx` (or a PDF export) with **"anyone with the link — Viewer"**
  access and test it in an incognito window before pasting the URL in the form.

## Defence deck — status wording

`tfm-defense-deck.pptx` still says "en revisión (PR #31/#32)" on its status
slides (4, 11, 13, 15) and carries a "repo privado" note on slide 15. Both are
now stale: PRs #31/#32 are merged and deployed and the repository is public —
update that wording if you ever present the technical deck.
