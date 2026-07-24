import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import eu from "../../../messages/eu.json";

/**
 * Repository-wide locale parity guard (ADR D13). Covers ALL namespaces in
 * `messages/{es,eu,en}.json`, not only the ones a given change adds — see
 * design.md D13 for the rationale (a Vitest test, repo-wide, rather than a
 * bespoke ESLint rule or CI step).
 *
 * `es` is the reference locale (the `next-intl` default). Three properties
 * are asserted, each catching a real bug class:
 *   1. Identical flattened key set across all three files (bidirectional).
 *   2. No empty-string / whitespace-only value in any locale.
 *   3. Identical ICU placeholder-argument set per key across locales.
 *
 * This guard checks key parity and placeholder parity ONLY. It does NOT,
 * and cannot, detect a wrong-language or low-quality translation — human
 * native-speaker review of Basque (`eu`) copy remains blocking (R5) and
 * this guard must never be cited as if it replaced that review.
 */

type MessageTree = Record<string, unknown>;

/** Flattens a nested message object to dot-path -> leaf value. Arrays are
 * treated as leaves (never recursed into) — matches how this repo's
 * namespaces use arrays (e.g. `Home.trust.hospitals`, `Home.artists.items`)
 * as opaque content lists, not as sets of independently-keyed strings. */
function flatten(tree: MessageTree, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(tree)) {
    const value = tree[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value as MessageTree, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

const esFlat = flatten(es as MessageTree);
const euFlat = flatten(eu as MessageTree);
const enFlat = flatten(en as MessageTree);

const esKeys = new Set(Object.keys(esFlat));
const euKeys = new Set(Object.keys(euFlat));
const enKeys = new Set(Object.keys(enFlat));

/** Symmetric-difference-style parity check with a self-explanatory failure message. */
function assertKeyParity(
  referenceLabel: string,
  referenceKeys: Set<string>,
  targetLabel: string,
  targetKeys: Set<string>,
): void {
  const missing = [...referenceKeys].filter((k) => !targetKeys.has(k)).sort();
  const extra = [...targetKeys].filter((k) => !referenceKeys.has(k)).sort();
  const message = [
    missing.length > 0
      ? `${targetLabel} is MISSING ${missing.length} key(s) present in ${referenceLabel}: ${missing.join(", ")}`
      : null,
    extra.length > 0
      ? `${targetLabel} has ${extra.length} EXTRA key(s) not present in ${referenceLabel}: ${extra.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  expect([...missing, ...extra], message).toEqual([]);
}

const ICU_ARG_PATTERN = /\{\s*(\w+)\b/g;

/** Extracts the top-level ICU argument-name set from a string value. Returns
 * `null` for a non-string leaf (e.g. an array or number), which the
 * placeholder-parity check treats as "not applicable" rather than a mismatch. */
function extractPlaceholders(value: unknown): Set<string> | null {
  if (typeof value !== "string") return null;
  const args = new Set<string>();
  for (const match of value.matchAll(ICU_ARG_PATTERN)) {
    args.add(match[1]);
  }
  return args;
}

describe("Locale parity guard (D13) — repository-wide, all namespaces", () => {
  it("es and eu share an identical flattened key set", () => {
    assertKeyParity("es", esKeys, "eu", euKeys);
  });

  it("es and en share an identical flattened key set", () => {
    assertKeyParity("es", esKeys, "en", enKeys);
  });

  it("eu and en share an identical flattened key set (transitively implied, asserted directly too)", () => {
    assertKeyParity("eu", euKeys, "en", enKeys);
  });

  it("no locale has an empty-string or whitespace-only value for any key", () => {
    const emptyEntries: string[] = [];
    for (const [label, flat] of [
      ["es", esFlat],
      ["eu", euFlat],
      ["en", enFlat],
    ] as const) {
      for (const [key, value] of Object.entries(flat)) {
        if (typeof value === "string" && value.trim() === "") {
          emptyEntries.push(`${label}.${key}`);
        }
      }
    }
    expect(emptyEntries, emptyEntries.join("\n")).toEqual([]);
  });

  it("each locale has exactly the six CentreType.* labels, one per centreType value (widen-beyond-hospitals D20)", () => {
    // The shared display-labels namespace (ADR D20) consumed by the finder
    // tag/filter. Registration and the admin queue keep their own
    // `Register.centreType.*` / `AdminProfiles.centreType.*` namespaces; this
    // asserts the top-level `CentreType.*` set is present and exactly six.
    const centreTypeValues = [
      "hospital",
      "nursing_home",
      "day_centre",
      "day_hospital",
      "occupational_centre",
      "palliative_unit",
    ].sort();
    for (const [label, tree] of [
      ["es", es],
      ["eu", eu],
      ["en", en],
    ] as const) {
      const namespace = (tree as MessageTree).CentreType as MessageTree | undefined;
      expect(namespace, `${label}.CentreType namespace is missing entirely`).toBeTruthy();
      const keys = Object.keys(namespace ?? {}).sort();
      expect(keys, `${label}.CentreType must have exactly the six centreType keys`).toEqual(
        centreTypeValues,
      );
    }
  });

  it("each locale has the auditable-profile-approval basis/legacy keys (D24/D27, PR4)", () => {
    // Structural-parity pin for the keys this change adds: the basis field
    // label, the two role-cued prompts (centre/artist), the deactivate
    // action labels, and the legacy-review label. This is STRUCTURE-only —
    // it proves the keys exist and are non-empty in all three locales, it
    // does NOT and cannot assess translation quality. `eu` here is DRAFT and
    // still requires native-speaker sign-off (design.md D27, tasks.md 5.9)
    // before merge; a green run of this test must never be cited as if it
    // were that review.
    const requiredKeys = [
      "ProfileActions.deactivate",
      "ProfileActions.deactivating",
      "ProfileActions.basis.label",
      "ProfileActions.basis.placeholder.centre",
      "ProfileActions.basis.placeholder.artist",
      "AdminProfiles.review.legacy",
    ];
    for (const [label, flat] of [
      ["es", esFlat],
      ["eu", euFlat],
      ["en", enFlat],
    ] as const) {
      for (const key of requiredKeys) {
        expect(flat[key], `${label}.${key} is missing`).toBeTypeOf("string");
        expect(
          typeof flat[key] === "string" && (flat[key] as string).trim().length > 0,
          `${label}.${key} must not be empty`,
        ).toBe(true);
      }
    }
  });

  it("ICU placeholder argument sets match across locales for every shared string key", () => {
    const mismatches: string[] = [];
    for (const key of esKeys) {
      if (!euKeys.has(key) || !enKeys.has(key)) continue; // caught by the key-parity checks above

      const esArgs = extractPlaceholders(esFlat[key]);
      const euArgs = extractPlaceholders(euFlat[key]);
      const enArgs = extractPlaceholders(enFlat[key]);
      if (esArgs === null && euArgs === null && enArgs === null) continue; // non-string leaf (array, number)

      const esSet = esArgs ?? new Set<string>();
      const euSet = euArgs ?? new Set<string>();
      const enSet = enArgs ?? new Set<string>();
      const union = new Set([...esSet, ...euSet, ...enSet]);

      for (const arg of union) {
        if (!esSet.has(arg) || !euSet.has(arg) || !enSet.has(arg)) {
          mismatches.push(
            `${key}: es=[${[...esSet].sort()}] eu=[${[...euSet].sort()}] en=[${[...enSet].sort()}]`,
          );
          break;
        }
      }
    }
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });
});
