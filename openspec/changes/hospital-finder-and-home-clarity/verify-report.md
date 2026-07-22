# Verification Report — hospital-finder-and-home-clarity

**Branch verified**: `feat/hospital-finder-about` (tip of chain, 21 commits, 36 files, +2886/-7 vs `main`). Working tree confirmed clean before and after all adversarial probes (`.claude/` and `openspec/changes/hospital-finder-and-home-clarity/` are the only untracked paths throughout, unrelated to this verification).

**Verdict: PASS WITH WARNINGS.** No CRITICAL findings. Implementation matches spec/design on every privacy-critical claim tested adversarially. Two pre-flagged open items (tasks 13.4, 13.5) remain correctly open — not defects.

## Evidence gathered (commands actually run, real output)

1. `npm run test` -> **361 passed / 0 failed / 61 skipped** (matches stated baseline exactly, both before and after every sabotage/revert cycle).
2. `npx tsc --noEmit` -> clean (0 errors).
3. `npm run lint` -> clean.
4. **D14 compile-time guard, empirically sabotaged**: added `addressLine: string | null` to `PublicHospitalProjection` -> `tsc --noEmit` failed with `TS2344: Type '"addressLine"' does not satisfy the constraint 'never'` at the DTO file itself, plus cascading errors in every consumer (use case, adapter, 5 test files). Reverted from backup; confirmed `git status`/`git diff` clean and `tsc` clean again.
5. **D13 locale parity guard, empirically sabotaged**: added `Finder.__verifySabotageKey` to `messages/eu.json` only -> `tests/unit/i18n/localeParity.test.ts` failed 2/5, naming the exact key and missing locale (`en is MISSING 1 key(s)... Finder.__verifySabotageKey`). Reverted; re-ran, 5/5 green.
6. **"Helpful badge" threat scenario, fully wired (not just a type edit)**: added `eventCount: number` to the DTO interface deliberately WITHOUT adding it to `ForbiddenPublicHospitalKey` (confirmed via `tsc` that this field alone does NOT trip the "does not satisfy constraint never" error), then wired it through `listPublicHospitals`'s field-by-field rebuild AND the Prisma adapter's `select`/return, simulating a complete real implementation. Ran `listPublicHospitals.test.ts` + `nonCorrelation.test.ts`: **7/12 tests failed** on the exact-key-set assertion. Confirms the design's own claim that the exact-key-set layer catches what the named-key layer structurally cannot. Fully reverted (`git checkout` on the adapter file, backup-restore on DTO/use-case); confirmed clean.
7. **Integration tests**: `VIVETUTIEMPO_RUN_INTEGRATION=true npx vitest run tests/integration/public-hospital-directory-query.test.ts` -> **6/6 passed** against real Neon Postgres. This wipes seed data per the environment warning -- immediately ran `npm run db:seed` afterward, then re-ran `npx playwright test e2e/hospital-directory.spec.ts` (16 passed, 1 documented skip) to confirm the app was left reseeded and working.
8. **e2e** (isolated per instructions): `npx playwright test e2e/hospital-directory.spec.ts e2e/non-correlation.spec.ts e2e/public-projection.spec.ts e2e/public-information.spec.ts` -> **27 passed, 1 skipped (documented null-coordinate gap), 0 failed**.

## Item-by-item findings

1. **D9 allow-list (exact 5 keys)** -- CONFIRMED exact: name, city, postalCode, latitude, longitude. Prisma adapter uses select (never include), rebuilds a fresh object literal per row. listPublicHospitals independently rebuilds field-by-field from the port result, never spreads. No path found where addressLine/email/internal id reaches a public response.
2. **D14 compile-time guard** -- CONFIRMED fires exactly as designed (evidence #4). Honest limit also confirmed empirically: a novel unnamed field (eventCount) does NOT trip the named-key guard -- but is caught by the exact-key-set layer instead (evidence #6).
3. **Exact-key-set test duplication** -- CONFIRMED: the expected key lists are literal arrays, not derived from the DTO type. A future DRY refactor would make the assertion vacuous -- exactly the failure mode the design warns about. WARNING (not CRITICAL): a known, accepted, documented risk per design.
4. **D10 non-correlation, both directions** -- CONFIRMED via the "helpful badge" empirical test (evidence #6). ESLint restricted-import zones proven against the real config object by tests/unit/lint/eslint-boundary.test.ts (10 passing assertions).
5. **Null-coordinate handling** -- CONFIRMED: selectMappableHospitals filters to non-null lat/lng before HospitalMap ever calls projectCoordinates; projectCoordinates's signature takes number, not number | null. Current seed has no ACTIVE hospital with null coordinates, so the e2e scenario is correctly test.skip'd with an in-file explanation; the invariant itself is unit-tested composing the real projectCoordinates. SUGGESTION: add one seeded null-coordinate ACTIVE hospital in a future batch.
6. **ACTIVE-only filtering, including via crafted search** -- CONFIRMED structurally impossible to bypass: listActive() takes no query parameter at all; search runs client-side over an already-server-filtered set (D12).
7. **Locale parity (D13)** -- CONFIRMED genuinely fails on divergence (evidence #5).
8. **Accessibility (D11)** -- CONFIRMED: pins are real button elements, aria-live result-count region present and e2e-asserted, heading structure verified via a repo-wide non-skip check, the map's inaccuracy is stated in visible UI copy, e2e-asserted.
9. **Seed** -- CONFIRMED via git diff: San Juan and Esperanza blocks are byte-for-byte untouched. 3 new ACTIVE hospitals each have a distinctive, populated addressLine. Idempotency confirmed by a dedicated integration test.

## Two deliberately-open items -- independent assessment, not certification

- **13.4 (content ownership /quienes-somos vs /ayuda)**: independent read concurs with the implementing agent's own assessment -- no meaningful duplication found. Does NOT close the task; human sign-off still required.
- **13.5 (Basque eu review)**: reads as plausible, grammatically coherent Euskara, no placeholder/lorem-ipsum text. Not a certification of translation quality. Remains a genuine blocking gate.

## Risks

None CRITICAL. One WARNING (exact-key-set test duplication, documented risk per design). Two pre-existing open items (13.4, 13.5) block merge-readiness per the change's own design, not verification findings.
