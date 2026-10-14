// Pure helpers behind scripts/export-translations.mjs (kept separate so they can
// be unit-tested without touching the filesystem).

/** Flattens nested objects/arrays into `{ "a.b.0.c": "value" }` (dot paths, array indices). */
export function flatten(value, prefix = "", out = {}) {
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out[prefix] = String(value);
  }
  return out;
}

/** RFC 4180 quoting: wrap in quotes when the cell has a comma, quote or line break. */
export function csvCell(value) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Builds the CSV text; a key missing from a locale becomes an empty cell. */
export function toCsv(messagesByLocale, locales = ["es", "eu", "en"]) {
  const flat = locales.map((locale) => flatten(messagesByLocale[locale]));
  const keys = [...new Set(flat.flatMap((entries) => Object.keys(entries)))];
  const rows = [["key", ...locales], ...keys.map((key) => [key, ...flat.map((entries) => entries[key] ?? "")])];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
