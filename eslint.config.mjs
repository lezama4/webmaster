import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Hexagonal boundary rules (design ADR D5): domain/ is framework-free and
  // must not depend on Next.js, Prisma, or outer layers. application/ may
  // depend on domain/ but not on infrastructure/ui/app.
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "next", message: "domain/ must be framework-free (ADR D5)." },
            { name: "@prisma/client", message: "domain/ must not depend on persistence." },
          ],
          patterns: [
            {
              group: ["next/*", "@/application/*", "@/infrastructure/*", "@/ui/*", "@/app/*", "@application/*", "@infrastructure/*", "@ui/*"],
              message: "domain/ may only depend on plain TypeScript (ADR D5).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "next", message: "application/ must stay framework-free." },
            { name: "@prisma/client", message: "application/ depends on ports, not concrete adapters." },
          ],
          patterns: [
            {
              group: ["next/*", "@/infrastructure/*", "@/ui/*", "@/app/*", "@infrastructure/*", "@ui/*"],
              message: "application/ may depend on domain/ and its own ports only.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
