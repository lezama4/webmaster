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
