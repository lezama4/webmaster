// Prisma seed runner. `prisma/seed.ts` imports application/infrastructure
// modules that use the project's `@`-path aliases, so it is loaded through
// Vite's SSR module loader using `vitest.config.ts` (which already resolves
// those aliases for the test suite) rather than a bare TS runner. This lives
// in a file — not an inline `node -e "..."` in package.json — because that
// one-liner breaks under Prisma's shell invocation (Node `-e` mis-parses the
// nested quotes: "Unterminated string constant").
import { createServer } from "vite";

const server = await createServer({
  configFile: "vitest.config.ts",
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  await server.ssrLoadModule("/prisma/seed.ts");
} finally {
  await server.close();
}
