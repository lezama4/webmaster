// Refuses to seed anything that is not a demo or a local database. The seed
// writes fictional accounts with a published password, so running it against a
// real database would create backdoor logins and fake content in production.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** True only when `databaseUrl` parses and its real host is local. Fails closed. */
function isLocalDatabase(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return false;
  }
  // A `host` query parameter can override the authority in some drivers.
  if (url.searchParams.has("host") || url.searchParams.has("hostaddr")) return false;
  return LOCAL_HOSTS.has(url.hostname);
}

/** Throws unless DEMO_MODE is exactly "true" or DATABASE_URL points at localhost/127.0.0.1. */
export function assertSeedAllowed(env: Readonly<Record<string, string | undefined>>): void {
  if (env.DEMO_MODE === "true" || isLocalDatabase(env.DATABASE_URL)) return;
  throw new Error(
    "Refusing to seed: the seed creates fictional accounts with a published password. " +
      'It only runs when DEMO_MODE="true" or DATABASE_URL points at localhost or 127.0.0.1. ' +
      "Never seed a production database.",
  );
}
