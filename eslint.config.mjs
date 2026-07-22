import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// M5: relative-import patterns that reach from src/domain/ or
// src/application/ into an outer layer, no matter how many `../`/`./`
// segments precede the layer name. Matches on the import SPECIFIER text
// (not resolved module paths), so it also catches boundary violations that
// target a layer folder that does not exist yet (this scaffold has not
// built application/infrastructure/ui yet).
function relativeLayerPattern(...layers) {
  return `^\\.{1,2}\\/(?:.*\\/)?(${layers.join("|")})(\\/|$)`;
}

const NODE_BUILTIN_PATTERN = "^node:";

// Representative persistence/HTTP packages the domain/application layers
// must never depend on directly (ADR D5) — not exhaustive, but proves a
// class of violation is caught, per review M5.
const RESTRICTED_PACKAGE_NAMES = [
  "@prisma/client",
  "pg",
  "mysql2",
  "mongodb",
  "mongoose",
  "redis",
  "ioredis",
  "axios",
  "undici",
  "express",
];

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
  // depend on domain/ but not on infrastructure/ui/app. M5: the boundary is
  // enforced against BOTH aliased (`@/application/*`) and relative
  // (`../application/*`) imports, Node builtins, representative
  // persistence/HTTP packages, and the restricted globals the domain
  // README bans (`process`, `fetch`).
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "next", message: "domain/ must be framework-free (ADR D5)." },
            ...RESTRICTED_PACKAGE_NAMES.map((name) => ({
              name,
              message: "domain/ must not depend on persistence/HTTP packages (ADR D5).",
            })),
          ],
          patterns: [
            {
              group: [
                "next/*",
                "@/application/*",
                "@/infrastructure/*",
                "@/ui/*",
                "@/app/*",
                "@application/*",
                "@infrastructure/*",
                "@ui/*",
              ],
              message: "domain/ may only depend on plain TypeScript (ADR D5).",
            },
            {
              regex: relativeLayerPattern("application", "infrastructure", "ui", "app"),
              message:
                "domain/ must not reach into an outer layer via a relative import (ADR D5, M5).",
            },
            {
              regex: NODE_BUILTIN_PATTERN,
              message: "domain/ must not import Node.js builtins (ADR D5, M5).",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "process", message: "domain/ must not read process/env directly (ADR D5, M5)." },
        { name: "fetch", message: "domain/ must not perform IO directly (ADR D5, M5)." },
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
            ...RESTRICTED_PACKAGE_NAMES.map((name) => ({
              name,
              message: "application/ depends on ports, not concrete adapters.",
            })),
          ],
          patterns: [
            {
              group: [
                "next/*",
                "@/infrastructure/*",
                "@/ui/*",
                "@/app/*",
                "@infrastructure/*",
                "@ui/*",
              ],
              message: "application/ may depend on domain/ and its own ports only.",
            },
            {
              regex: relativeLayerPattern("infrastructure", "ui", "app"),
              message:
                "application/ must not reach into an outer layer via a relative import (ADR D5, M5).",
            },
            {
              regex: NODE_BUILTIN_PATTERN,
              message: "application/ must not import Node.js builtins directly (ADR D5, M5).",
            },
          ],
        },
      ],
    },
  },
  // D10 cross-surface isolation: the application layer cannot see a
  // UI-level join between the hospital directory and events surfaces, so
  // ESLint closes that route. Neither surface's route/page may import the
  // OTHER surface's use case, DTO, port, or composition-root factory —
  // even though both live under src/app/ and nothing stops a same-layer
  // import at the domain/application boundary rules above. See design.md
  // D10's enforcement-layer table ("Finder page imports listPublishedEvents").
  {
    files: [
      "src/app/encuentra-tu-momento/**/*.{ts,tsx}",
      "src/app/api/hospitals/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@application/use-cases/listPublishedEvents",
              message: "The hospital directory surface must not import the Events surface (ADR D10).",
            },
            {
              name: "@application/dto/PublicEventProjection",
              message: "The hospital directory surface must not import the Events surface (ADR D10).",
            },
            {
              name: "@application/ports/PublicEventProjectionQuery",
              message: "The hospital directory surface must not import the Events surface (ADR D10).",
            },
            {
              name: "@infrastructure/composition/container",
              importNames: ["publicDeps"],
              message:
                "The hospital directory surface must not import the Events surface's composition factory (ADR D10).",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/app/events/**/*.{ts,tsx}",
      "src/app/api/events/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@application/use-cases/listPublicHospitals",
              message: "The Events surface must not import the hospital directory surface (ADR D10).",
            },
            {
              name: "@application/dto/PublicHospitalProjection",
              message: "The Events surface must not import the hospital directory surface (ADR D10).",
            },
            {
              name: "@application/ports/PublicHospitalDirectoryQuery",
              message: "The Events surface must not import the hospital directory surface (ADR D10).",
            },
            {
              name: "@infrastructure/composition/container",
              importNames: ["hospitalDirectoryDeps"],
              message:
                "The Events surface must not import the hospital directory surface's composition factory (ADR D10).",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
