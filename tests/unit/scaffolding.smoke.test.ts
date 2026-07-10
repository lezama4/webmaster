import { describe, expect, it } from "vitest";

// Smoke test proving the Vitest runner is wired up correctly for the
// domain/application layers (Phase 1 scaffolding). Real domain tests
// start in Phase 2 (strict TDD: tests/unit/domain/*.test.ts).
describe("vitest runner", () => {
  it("runs unit tests", () => {
    expect(1 + 1).toBe(2);
  });
});
