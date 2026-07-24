import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * Shared E2E fixtures/helpers (tasks 5.9/5.14/5.15/6.2/6.4). Every helper
 * here drives the real UI (`page.goto`/`fill`/`click`) so the browser sets
 * the same-origin `Origin` header the CSRF guard (`csrfGuard.ts`, task 5.13)
 * requires — no helper here bypasses that check.
 */

/** Matches `prisma/seed.ts`'s `SEED_PASSWORD` — the single password every seeded Account shares. */
export const SEED_PASSWORD = "VivetuTiempo2026!";

/**
 * Seeded Account credentials (mirrors `prisma/seed.ts`'s `IDS.accounts` +
 * literal emails). Intentionally NOT imported from `prisma/seed.ts` itself —
 * that file's top-level `main().then(...)` executes a real seeding run as a
 * side effect of import, which must never happen just by loading a spec.
 */
export const SEED_USERS = {
  admin: { email: "admin@vtt.test", password: SEED_PASSWORD },
  hospitalSanJuan: { email: "hospital.sanjuan@vtt.test", password: SEED_PASSWORD },
  hospitalEsperanza: { email: "hospital.esperanza@vtt.test", password: SEED_PASSWORD },
  artistClara: { email: "artist.clara@vtt.test", password: SEED_PASSWORD },
  artistMateo: { email: "artist.mateo@vtt.test", password: SEED_PASSWORD },
  artistLucia: { email: "artist.lucia@vtt.test", password: SEED_PASSWORD },
  patientAna: { email: "patient.ana@vtt.test", password: SEED_PASSWORD },
} as const;

/**
 * Seeded Slot/Proposal ids (mirrors `prisma/seed.ts`'s `IDS.slots` /
 * `IDS.proposals`), duplicated here for the same reason as `SEED_USERS`.
 */
export const SEED_SLOT_IDS = {
  s1OpenCompeting: "seed-slot-s1-open-competing-proposals",
  s2FilledPublished: "seed-slot-s2-filled-published-event",
  s3OpenEmpty: "seed-slot-s3-open-empty",
  s4ClosedCascade: "seed-slot-s4-closed-cascade",
  s5FilledCompleted: "seed-slot-s5-filled-completed-event",
} as const;

export const SEED_PROPOSAL_IDS = {
  s1Clara: "seed-proposal-s1-clara-submitted",
  s1Mateo: "seed-proposal-s1-mateo-submitted",
  s2MateoAccepted: "seed-proposal-s2-mateo-accepted",
  s4MateoCascadeRejected: "seed-proposal-s4-mateo-cascade-rejected",
  s5ClaraAccepted: "seed-proposal-s5-clara-accepted",
} as const;

/** The one published seeded Event's Slot title (S2) — the only Event `GET /api/events` may ever return from the seed. */
export const SEED_PUBLISHED_EVENT_TITLE = "Taller de acuarela";

/** S5's Slot title — a `completed` (not `published`) Event that must NEVER appear in the public projection. */
export const SEED_COMPLETED_EVENT_TITLE = "Concierto de cámara";

/** Every seeded Slot's `location` — must never leak through the public projection (D6). */
export const SEED_LOCATIONS = [
  "Planta 2, sala de convivencia",
  "Planta 1, aula cultural",
  "Biblioteca hospitalaria",
  "Pediatría, sala de familias",
  "Salón de actos",
] as const;

/** A seeded Proposal `message` — must never leak through the public projection (D6). */
export const SEED_PROPOSAL_MESSAGE_SAMPLE =
  "Tengo experiencia facilitando talleres de acuarela en grupo.";

/**
 * The two seeded hospitals' PUBLIC location fields (Phase 2, mirrors
 * `prisma/seed.ts`). These are a SEPARATE, public surface on `Profile` —
 * unlike `SEED_LOCATIONS` (Slot's private ward/room), they are allowed to
 * exist somewhere in the system. This constant exists so a privacy test can
 * assert the OPPOSITE of `SEED_LOCATIONS`'s check: even though this data is
 * public, it must still never leak through the Event projection, which only
 * ever carries Slot + accepted-Proposal-artist fields (ADR D6) — Profile
 * (hospital) fields, public or not, are simply never part of that surface.
 */
export const SEED_HOSPITAL_LOCATIONS = [
  "Plaza de Cruces, 12",
  "Paseo de la Castellana, 261",
  // Phase 4 (hospital-finder-and-home-clarity) — the 3 new ACTIVE hospitals'
  // `addressLine`s. Distinctive strings so a leak-assertion test can prove
  // `addressLine` never reaches the public hospital directory (D14).
  "Avenida del Mar, 45",
  "Calle Santa Clara, 8",
  "Paseo San Rafael, 33",
  // 10-hospital roster expansion — the 5 more `addressLine`-bearing ACTIVE
  // hospitals. Hospital del Guadiana (Extremadura) deliberately has NO
  // `addressLine` (nor coordinates) and is intentionally absent from this
  // list — see `SEED_ACTIVE_HOSPITALS`'s comment.
  "Paseo del Urumea, 5",
  "Calle de Monteverde, 19",
  "Rambla del Besòs, 7",
  "Paseo do Orzán, 22",
  "Avenida del Bernesga, 14",
  // widen-beyond-hospitals PR4 — Centro Ocupacional Aravaca's addressLine.
  "Calle de la Dehesa de Aravaca, 9",
] as const;

/**
 * The 11 seeded ACTIVE centres' PUBLIC directory fields (Phase 10 + the
 * 10-hospital roster expansion + `widen-beyond-hospitals` PR4's seed
 * diversification, mirrors `prisma/seed.ts`'s
 * `name`/`city`/`postalCode`/`centreType`). Distinct cities and postal-code
 * prefixes so search-by-name/city/postal-prefix is demonstrable end-to-end
 * against the real seed, without mutating it. Used by both
 * `hospital-directory.spec.ts` (positive assertions) and
 * `non-correlation.spec.ts` (D10: these strings must never appear on the
 * public Events surface).
 *
 * Hospital del Guadiana (Extremadura) is included here (it IS ACTIVE, with
 * `city`/`postalCode`) but has no coordinates and no `addressLine` — it is
 * the seed's deliberate "listed but not pinned" case.
 *
 * Four rows carrying a non-hospital `centreType` (Urumea/Monteverde/Besòs/
 * Bernesga) were repurposed in PR4 from hospitals of the same name/id/city/
 * postal code — kept as hospitals below (San Juan/del Mar/Santa Clara/San
 * Rafael/do Orzán/del Guadiana) because their exact NAME backs other e2e
 * assertions elsewhere in this file's suites (name/city/diacritic search,
 * city-sort ordering, the no-coordinates case). Centro Ocupacional Aravaca
 * is a brand-new PR4 row, the sixth `centreType`.
 */
export const SEED_ACTIVE_HOSPITALS = [
  { name: "Hospital San Juan", city: "Bilbao", postalCode: "48013", centreType: "hospital" },
  {
    name: "Hospital Universitario del Mar",
    city: "Valencia",
    postalCode: "46011",
    centreType: "hospital",
  },
  { name: "Hospital Santa Clara", city: "Sevilla", postalCode: "41003", centreType: "hospital" },
  { name: "Hospital San Rafael", city: "Zaragoza", postalCode: "50009", centreType: "hospital" },
  {
    name: "Residencia Urumea",
    city: "Donostia-San Sebastián",
    postalCode: "20003",
    centreType: "nursing_home",
  },
  {
    name: "Centro de Día Monteverde",
    city: "Madrid",
    postalCode: "28003",
    centreType: "day_centre",
  },
  {
    name: "Hospital de Día del Besòs",
    city: "Barcelona",
    postalCode: "08019",
    centreType: "day_hospital",
  },
  { name: "Hospital do Orzán", city: "A Coruña", postalCode: "15003", centreType: "hospital" },
  {
    name: "Unidad de Cuidados Paliativos del Bernesga",
    city: "León",
    postalCode: "24001",
    centreType: "palliative_unit",
  },
  { name: "Hospital del Guadiana", city: "Badajoz", postalCode: "06001", centreType: "hospital" },
  {
    name: "Centro Ocupacional Aravaca",
    city: "Madrid",
    postalCode: "28023",
    centreType: "occupational_centre",
  },
] as const;

/** Every seeded ACTIVE centre's `centreType` value, one per row of `SEED_ACTIVE_HOSPITALS` — all six `CentreType` values are represented (widen-beyond-hospitals PR4). */
export const SEED_ACTIVE_CENTRE_TYPES = [
  "hospital",
  "nursing_home",
  "day_centre",
  "day_hospital",
  "occupational_centre",
  "palliative_unit",
] as const;

/** The one seeded ACTIVE hospital with no coordinates (Phase 4 gap closed, hospital-finder-and-home-clarity follow-up): listed in the directory but renders no map pin, never defaulted to 0,0. */
export const SEED_NO_COORDINATES_HOSPITAL_NAME = "Hospital del Guadiana";

/** The one seeded `PENDING` hospital — MUST NEVER appear in the public hospital directory (D9). */
export const SEED_PENDING_HOSPITAL_NAME = "Hospital Esperanza";

/**
 * Seeded Rating ids (Phase 3, Block 2, mirrors `prisma/seed.ts`'s
 * `IDS.ratings`) — S2's published Event has 3 ratings (Ana/Clara/Lucía)
 * averaging 4.7. Individual Rating ids AND the rater Accounts' own ids must
 * never leak through the public projection — only the aggregate
 * (`averageStars`/`ratingCount`) is public (ADR D6 extension).
 */
export const SEED_RATING_IDS = [
  "seed-rating-s2-ana",
  "seed-rating-s2-clara",
  "seed-rating-s2-lucia",
] as const;

/** The seeded rater Accounts' own ids (mirrors `IDS.accounts`) — must never leak through the public projection either (only the aggregate is public). */
export const SEED_RATER_ACCOUNT_IDS = [
  "seed-account-patient-ana",
  "seed-account-artist-clara",
  "seed-account-artist-lucia",
] as const;

/** S2's published Event's expected rating aggregate (Ana 5, Clara 4, Lucía 5 -> avg 4.7, count 3). */
export const SEED_PUBLISHED_EVENT_RATING_AGGREGATE = {
  averageStars: 4.7,
  ratingCount: 3,
} as const;

/** A short, run-unique suffix for emails/titles so parallel/repeated runs never collide. */
export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
}

/** Formats a `datetime-local` input value strictly in the future (Slot domain invariant, N2). */
export function futureDatetimeLocal(daysFromNow: number): string {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Opens a fresh browser context + page and logs in via the real `/login`
 * form. A fresh context per actor keeps each role's session cookie isolated
 * — no two actors in the same test ever share (or overwrite) a cookie jar.
 */
export async function loginAsNewSession(
  browser: Browser,
  credentials: { email: string; password: string },
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator("#email").fill(credentials.email);
  await page.locator("#password").fill(credentials.password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return { context, page };
}

/** Registers a new Centre/Artist profile via the real `/register` form. Leaves the profile `pending` — no session is created by registration. `centreType` defaults to the form's own default ("hospital") when the role is `centre` and no override is given (D18). */
export async function registerViaUi(
  page: Page,
  input: {
    role: "centre" | "artist";
    name: string;
    email: string;
    password: string;
    centreType?: string;
  },
): Promise<void> {
  await page.goto("/register");
  await page.locator("#role").selectOption(input.role);
  if (input.role === "centre" && input.centreType) {
    await page.locator("#centreType").selectOption(input.centreType);
  }
  await page.locator("#name").fill(input.name);
  await page.locator("#email").fill(input.email);
  await page.locator("#password").fill(input.password);
  await page.getByRole("button", { name: /create profile/i }).click();
  await expect(page.getByRole("heading", { name: "Request received" })).toBeVisible();
}

/**
 * Approves a pending Profile (matched by its display name) from the Admin
 * validation queue. `adminPage` must already be an authenticated admin
 * session. Fills the required basis textarea first (auditable-profile-
 * approval, D24) — the approve button stays disabled until it is non-blank.
 *
 * Scoped to `#pending-profiles` (not a bare `li` text filter): once approved,
 * the SAME displayName reappears in the page's `#active-profiles` section
 * (PR4/5.6), so an unscoped filter would still find one match afterwards.
 */
export async function approveProfileByName(adminPage: Page, displayName: string): Promise<void> {
  await adminPage.goto("/admin/profiles");
  const row = adminPage.locator("#pending-profiles li").filter({ hasText: displayName });
  await expect(row).toBeVisible();
  await row.locator("textarea").fill("E2E fixture approval — verification basis for test setup.");
  await row.getByRole("button", { name: "Approve" }).click();
  // Approve now triggers a `saveReview` write (auditable-profile-approval,
  // D23) on top of the existing status transition, and `router.refresh()`
  // re-fetches BOTH the pending and active listings before the row
  // disappears — one more round trip against the remote Neon dev host than
  // before this change. The default 5s expect timeout is occasionally too
  // tight for that combined latency; extended explicitly rather than
  // silently retried (same rationale as the integration suite's per-test
  // timeout bump in login-vs-deactivation-race.test.ts).
  await expect(row).toHaveCount(0, { timeout: 15_000 });
}

/** Publishes a Slot via the real Hospital dashboard form. `hospitalPage` must already be an authenticated, approved Hospital session. */
export async function publishSlotViaUi(
  hospitalPage: Page,
  input: {
    title: string;
    description: string;
    scheduledAtLocal: string;
    durationMinutes: number;
    location: string;
  },
): Promise<void> {
  await hospitalPage.goto("/hospital/slots");
  await hospitalPage.locator("#title").fill(input.title);
  await hospitalPage.locator("#description").fill(input.description);
  await hospitalPage.locator("#scheduledAt").fill(input.scheduledAtLocal);
  await hospitalPage.locator("#durationMinutes").fill(String(input.durationMinutes));
  await hospitalPage.locator("#location").fill(input.location);
  await hospitalPage.getByRole("button", { name: /publish slot/i }).click();
  await expect(hospitalPage.locator("li").filter({ hasText: input.title })).toBeVisible();
}

/** Returns the outer Slot card `<li>` locator for a Slot, matched by its (unique) title. Works on both the Hospital board and the Artist open-slots listing. */
export function slotCard(page: Page, slotTitle: string) {
  return page.locator("li").filter({ hasText: slotTitle });
}

/** Submits a Proposal on an open Slot via the real Artist dashboard form. `artistPage` must already be an authenticated, approved Artist session. */
export async function proposeActivityViaUi(
  artistPage: Page,
  slotTitle: string,
  message: string,
): Promise<void> {
  await artistPage.goto("/artist/slots");
  const card = slotCard(artistPage, slotTitle);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Propose an activity" }).click();
  await card.locator("textarea").fill(message);
  await card.getByRole("button", { name: "Send proposal" }).click();
  await expect(card.getByText("Proposal sent")).toBeVisible();
}

/** Approves one Proposal (matched by the artist's display name) on a Slot from the Hospital dashboard. `hospitalPage` must already be an authenticated, owning Hospital session. */
export async function approveProposalViaUi(
  hospitalPage: Page,
  slotTitle: string,
  artistDisplayName: string,
): Promise<void> {
  await hospitalPage.goto("/hospital/slots");
  const card = slotCard(hospitalPage, slotTitle);
  const proposalRow = card.locator("li").filter({ hasText: artistDisplayName });
  await proposalRow.getByRole("button", { name: "Approve" }).click();
}

/** Closes an open Slot (owner-Hospital-only withdrawal, B2) from the Hospital dashboard. */
export async function closeSlotViaUi(hospitalPage: Page, slotTitle: string): Promise<void> {
  await hospitalPage.goto("/hospital/slots");
  const card = slotCard(hospitalPage, slotTitle);
  await card.getByRole("button", { name: "Close slot" }).click();
}
