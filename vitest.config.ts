import { defineConfig } from "vitest/config";
import path from "node:path";

const alias = {
  "@": path.resolve(__dirname, "./src"),
  "@domain": path.resolve(__dirname, "./src/domain"),
  "@application": path.resolve(__dirname, "./src/application"),
  "@infrastructure": path.resolve(__dirname, "./src/infrastructure"),
  "@ui": path.resolve(__dirname, "./src/ui"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/application/**"],
    },
    // pr2b-M3: unit and integration tests run as separate Vitest projects.
    // The integration project owns its own database lifecycle (global
    // migration setup) and concurrency policy (fully serial) — the unit
    // project keeps Vitest's default, fast, parallel execution.
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Every integration file shares ONE Postgres database and
          // destructively resets it in `beforeEach` (see
          // tests/integration/support/db.ts's `resetDatabase`). Vitest's
          // default file-level parallelism would let one file erase
          // another's fixtures mid-assertion, and could start a
          // non-migration file before the migration file has applied an
          // empty database. `fileParallelism: false` forces fully serial
          // execution (Vitest 4: this also overrides `maxWorkers` to 1) —
          // one file at a time, no concurrent test bodies across files.
          fileParallelism: false,
          // Applies every pending Prisma migration against the configured
          // test database ONCE, before any integration test file loads —
          // no individual test file establishes schema itself (pr2b-M3;
          // supersedes the prior design where schema-migration.test.ts was
          // the de facto migration bootstrap for whichever file ran
          // first).
          globalSetup: ["./tests/integration/support/globalSetup.ts"],
        },
      },
    ],
  },
});
