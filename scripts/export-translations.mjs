#!/usr/bin/env node
// Read-only: prints messages/{es,eu,en}.json as CSV (key, es, eu, en) to stdout
// so a translator can review them. Missing keys are empty cells. Writes nothing.
//   node scripts/export-translations.mjs > /tmp/translations.csv
import { readFileSync } from "node:fs";
import { toCsv } from "./lib/translations.mjs";

const locales = ["es", "eu", "en"];
const messages = Object.fromEntries(
  locales.map((locale) => [
    locale,
    JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")),
  ]),
);

process.stdout.write(toCsv(messages, locales));
