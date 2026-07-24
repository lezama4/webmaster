import { expect, test, type BrowserContext } from "@playwright/test";
import {
  SEED_USERS,
  approveProfileByName,
  approveProposalViaUi,
  futureDatetimeLocal,
  loginAsNewSession,
  proposeActivityViaUi,
  publishSlotViaUi,
  registerViaUi,
  slotCard,
  uniqueSuffix,
} from "./support/helpers";

// Task 5.9 — the full demo chain: register a fresh Hospital + Artist, have
// an Admin approve both, have the Hospital publish a Slot, have TWO Artists
// propose on it (so approval demonstrates the auto-reject-rival cascade,
// ADR D4), have the Hospital approve the winner, then confirm the resulting
// Event is publicly visible. Every mutation is driven through the real UI so
// the browser supplies the same-origin `Origin` header the CSRF guard
// requires (task 5.13). Assertions target the presence of THIS run's own
// data (unique per run via `uniqueSuffix()`), never brittle exact counts
// against the seeded dataset — this suite runs alongside other specs and
// against a shared seeded database.
test("demo chain: register -> admin approve -> publish -> propose -> accept -> auto-reject rival -> public browse", async ({
  browser,
  page,
}) => {
  // Each admin approval now also persists an attributed ProfileReview in the
  // same transaction (auditable-profile-approval, D23) and the queue page
  // re-fetches both the pending AND active listings on refresh — one more
  // DB round trip per approval than before, against the remote Neon dev
  // host. This flow does THREE approvals plus the full publish/propose/
  // accept/auto-reject/public-browse chain; extended explicitly rather than
  // silently retried.
  test.setTimeout(90_000);

  const runId = uniqueSuffix();
  const password = "DemoChainPass123!";

  const hospital = {
    role: "centre" as const,
    name: `Demo Hospital ${runId}`,
    email: `hospital.demo.${runId}@vtt.test`,
    password,
  };
  const winnerArtist = {
    role: "artist" as const,
    name: `Demo Winner Artist ${runId}`,
    email: `artist.winner.${runId}@vtt.test`,
    password,
  };
  const rivalArtist = {
    role: "artist" as const,
    name: `Demo Rival Artist ${runId}`,
    email: `artist.rival.${runId}@vtt.test`,
    password,
  };
  const slotTitle = `Demo Slot ${runId}`;

  const contexts: BrowserContext[] = [];
  try {
    // 1. Register the Hospital and both Artists (each self-registration is
    // an unauthenticated form submission — no session exists yet).
    await registerViaUi(page, hospital);
    await registerViaUi(page, winnerArtist);
    await registerViaUi(page, rivalArtist);

    // 2. Admin logs in and approves all three pending profiles.
    const admin = await loginAsNewSession(browser, SEED_USERS.admin);
    contexts.push(admin.context);
    await approveProfileByName(admin.page, hospital.name);
    await approveProfileByName(admin.page, winnerArtist.name);
    await approveProfileByName(admin.page, rivalArtist.name);

    // 3. The Hospital logs in and publishes a Slot.
    const hospitalSession = await loginAsNewSession(browser, hospital);
    contexts.push(hospitalSession.context);
    await publishSlotViaUi(hospitalSession.page, {
      title: slotTitle,
      description: "A short acoustic set for patients and families.",
      scheduledAtLocal: futureDatetimeLocal(10),
      durationMinutes: 45,
      location: "Ward 3 common room",
    });

    // 4. Both Artists propose on the same Slot.
    const winnerSession = await loginAsNewSession(browser, winnerArtist);
    contexts.push(winnerSession.context);
    await proposeActivityViaUi(
      winnerSession.page,
      slotTitle,
      "I can bring a short acoustic set adapted to the ward.",
    );

    const rivalSession = await loginAsNewSession(browser, rivalArtist);
    contexts.push(rivalSession.context);
    await proposeActivityViaUi(
      rivalSession.page,
      slotTitle,
      "I'd like to offer a storytelling session instead.",
    );

    // 5. The Hospital approves the winner's Proposal — this triggers the
    // domain's auto-reject-rival cascade (ADR D4): the rival's Proposal is
    // rejected, the Slot fills, and an Event is created + published.
    await approveProposalViaUi(hospitalSession.page, slotTitle, winnerArtist.name);

    const card = slotCard(hospitalSession.page, slotTitle);
    await expect(card.getByText(/^Filled$/)).toBeVisible();
    await expect(card.locator("li").filter({ hasText: winnerArtist.name })).toContainText(
      "Accepted",
    );
    await expect(card.locator("li").filter({ hasText: rivalArtist.name })).toContainText(
      "Rejected",
    );

    // 6. The published Event is now publicly visible, unauthenticated.
    await page.goto("/events");
    const publicCard = page.locator("li").filter({ hasText: slotTitle });
    await expect(publicCard).toBeVisible();
    await expect(publicCard).toContainText(winnerArtist.name);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
