import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

// M5: proves the domain boundary rule in `eslint.config.mjs` actually
// rejects representative violations, rather than only observing that the
// current (clean) domain imports happen to pass. Runs the ESLint API
// against IN-MEMORY snippets with a virtual filename inside `src/domain/`
// — no violating file is added to the tree that `npm run lint` walks.
import eslintConfig from "../../../eslint.config.mjs";

interface FlatConfigEntry {
  readonly files?: readonly string[];
  readonly rules?: Linter.RulesRecord;
}

function findRulesFor(filesPattern: string): Linter.RulesRecord {
  const entry = (eslintConfig as readonly FlatConfigEntry[]).find((c) =>
    c.files?.includes(filesPattern),
  );
  if (!entry?.rules) {
    throw new Error(
      `eslint.config.mjs has no rules block for files pattern '${filesPattern}' — did the boundary config move?`,
    );
  }
  return entry.rules;
}

const DOMAIN_FILENAME = "src/domain/slot/__lint-fixture__.ts";
const APPLICATION_FILENAME = "src/application/__lint-fixture__.ts";

function lintSnippet(rules: Linter.RulesRecord, code: string, filename: string) {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(
    code,
    [
      {
        files: ["**/*.ts"],
        languageOptions: { ecmaVersion: 2022, sourceType: "module" },
        rules,
      },
    ],
    { filename },
  );
}

describe("ESLint domain/application boundary (M5)", () => {
  const domainRules = findRulesFor("src/domain/**/*.{ts,tsx}");
  const applicationRules = findRulesFor("src/application/**/*.{ts,tsx}");

  it("flags a domain/ relative import reaching into infrastructure/", () => {
    const messages = lintSnippet(
      domainRules,
      'import { thing } from "../infrastructure/thing";',
      DOMAIN_FILENAME,
    );

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("flags a domain/ relative import reaching into application/", () => {
    const messages = lintSnippet(
      domainRules,
      'import { useCase } from "../../application/useCase";',
      DOMAIN_FILENAME,
    );

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("flags a domain/ import of a Node.js builtin", () => {
    const messages = lintSnippet(domainRules, 'import fs from "node:fs";', DOMAIN_FILENAME);

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("flags a domain/ import of a representative persistence package", () => {
    const messages = lintSnippet(domainRules, 'import { Pool } from "pg";', DOMAIN_FILENAME);

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("flags domain/ use of the restricted `process` global", () => {
    const messages = lintSnippet(domainRules, "const x = process.env.FOO;", DOMAIN_FILENAME);

    expect(messages.some((m) => m.ruleId === "no-restricted-globals")).toBe(true);
  });

  it("flags domain/ use of the restricted `fetch` global", () => {
    const messages = lintSnippet(domainRules, 'fetch("https://example.com");', DOMAIN_FILENAME);

    expect(messages.some((m) => m.ruleId === "no-restricted-globals")).toBe(true);
  });

  it("does NOT flag a legitimate same-layer relative import from domain/", () => {
    const messages = lintSnippet(
      domainRules,
      'import { Clock } from "../shared/Clock";',
      DOMAIN_FILENAME,
    );

    expect(messages).toEqual([]);
  });

  it("flags an application/ relative import reaching into infrastructure/", () => {
    const messages = lintSnippet(
      applicationRules,
      'import { repo } from "../infrastructure/repo";',
      APPLICATION_FILENAME,
    );

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("does NOT flag application/ depending on domain/", () => {
    const messages = lintSnippet(
      applicationRules,
      'import { createSlot } from "../domain/slot/Slot";',
      APPLICATION_FILENAME,
    );

    expect(messages).toEqual([]);
  });
});

// D10: the application layer cannot see a UI-level join, so ESLint closes
// that route. Neither public surface's route/page may import the OTHER
// surface's use case, DTO, port, or composition-root factory (design.md
// D10 enforcement-layer table, "Finder page imports listPublishedEvents"
// row) — proven here the same way the M5 domain/application boundary is
// proven above: fixtures against the real config, not just observing that
// current (clean) imports happen to pass.
describe("ESLint D10 cross-surface isolation (hospital directory <-> events)", () => {
  const hospitalSurfaceRules = findRulesFor("src/app/encuentra-tu-momento/**/*.{ts,tsx}");
  const eventSurfaceRules = findRulesFor("src/app/events/**/*.{ts,tsx}");

  const HOSPITAL_PAGE_FILENAME = "src/app/encuentra-tu-momento/__lint-fixture__.ts";
  const HOSPITAL_API_FILENAME = "src/app/api/hospitals/__lint-fixture__.ts";
  const EVENT_PAGE_FILENAME = "src/app/events/__lint-fixture__.ts";
  const EVENT_API_FILENAME = "src/app/api/events/__lint-fixture__.ts";

  it("flags src/app/encuentra-tu-momento/** importing listPublishedEvents", () => {
    const messages = lintSnippet(
      hospitalSurfaceRules,
      'import { listPublishedEvents } from "@application/use-cases/listPublishedEvents";',
      HOSPITAL_PAGE_FILENAME,
    );

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("flags src/app/encuentra-tu-momento/** importing PublicEventProjection", () => {
    const messages = lintSnippet(
      hospitalSurfaceRules,
      'import { PublicEventProjection } from "@application/dto/PublicEventProjection";',
      HOSPITAL_PAGE_FILENAME,
    );

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("flags src/app/encuentra-tu-momento/** importing PublicEventProjectionQuery", () => {
    const messages = lintSnippet(
      hospitalSurfaceRules,
      'import { PublicEventProjectionQuery } from "@application/ports/PublicEventProjectionQuery";',
      HOSPITAL_PAGE_FILENAME,
    );

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("flags src/app/api/hospitals/** importing publicDeps from the container", () => {
    const messages = lintSnippet(
      hospitalSurfaceRules,
      'import { publicDeps } from "@infrastructure/composition/container";',
      HOSPITAL_API_FILENAME,
    );

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("does NOT flag src/app/api/hospitals/** importing hospitalDirectoryDeps from the container", () => {
    const messages = lintSnippet(
      hospitalSurfaceRules,
      'import { hospitalDirectoryDeps } from "@infrastructure/composition/container";',
      HOSPITAL_API_FILENAME,
    );

    expect(messages).toEqual([]);
  });

  it("flags src/app/events/** importing listPublicHospitals", () => {
    const messages = lintSnippet(
      eventSurfaceRules,
      'import { listPublicHospitals } from "@application/use-cases/listPublicHospitals";',
      EVENT_PAGE_FILENAME,
    );

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("flags src/app/events/** importing PublicHospitalProjection", () => {
    const messages = lintSnippet(
      eventSurfaceRules,
      'import { PublicHospitalProjection } from "@application/dto/PublicHospitalProjection";',
      EVENT_PAGE_FILENAME,
    );

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("flags src/app/events/** importing PublicHospitalDirectoryQuery", () => {
    const messages = lintSnippet(
      eventSurfaceRules,
      'import { PublicHospitalDirectoryQuery } from "@application/ports/PublicHospitalDirectoryQuery";',
      EVENT_PAGE_FILENAME,
    );

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("flags src/app/api/events/** importing hospitalDirectoryDeps from the container", () => {
    const messages = lintSnippet(
      eventSurfaceRules,
      'import { hospitalDirectoryDeps } from "@infrastructure/composition/container";',
      EVENT_API_FILENAME,
    );

    expect(messages.some((m) => m.ruleId === "no-restricted-imports")).toBe(true);
  });

  it("does NOT flag src/app/api/events/** importing publicDeps from the container", () => {
    const messages = lintSnippet(
      eventSurfaceRules,
      'import { publicDeps } from "@infrastructure/composition/container";',
      EVENT_API_FILENAME,
    );

    expect(messages).toEqual([]);
  });
});
