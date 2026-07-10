# UI Layer (presentational components)

Reusable, presentational React components (Tailwind). `src/app` composes
these components into pages; `src/app` route handlers call
`src/application` use cases directly.

See ADR D5 in `openspec/changes/bootstrap-vivetutiempo-platform/design.md`
for why `src/app` (Next.js routing requirement) and `src/ui`
(presentational components) are split.
