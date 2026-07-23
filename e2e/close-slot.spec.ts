import { expect, test, type BrowserContext } from "@playwright/test";
import {
  SEED_USERS,
  approveProfileByName,
  futureDatetimeLocal,
  loginAsNewSession,
  proposeActivityViaUi,
  publishSlotViaUi,
  registerViaUi,
  slotCard,
  uniqueSuffix,
} from "./support/helpers";

// Task 5.14 — a Hospital publishes a Slot, an Artist proposes on it, and the
// Hospital closes the Slot (owner-only withdrawal, ADR B2) BEFORE deciding
// on the Proposal. Closing must cascade-reject every outstanding `submitted`
// Proposal and the Slot must stop accepting new Proposals. Uses fresh,
// run-unique accounts so this spec is safe to run in parallel with any
// other spec touching the seeded dataset.
test("closing a slot with an outstanding proposal rejects it and stops accepting new proposals", async ({
  browser,
  page,
}) => {
  const runId = uniqueSuffix();
  const password = "CloseSlotPass123!";

  const hospital = {
    role: "centre" as const,
    name: `Close Hospital ${runId}`,
    email: `hospital.close.${runId}@vtt.test`,
    password,
  };
  const artist = {
    role: "artist" as const,
    name: `Close Artist ${runId}`,
    email: `artist.close.${runId}@vtt.test`,
    password,
  };
  const slotTitle = `Close Slot ${runId}`;

  const contexts: BrowserContext[] = [];
  try {
    await registerViaUi(page, hospital);
    await registerViaUi(page, artist);

    const admin = await loginAsNewSession(browser, SEED_USERS.admin);
    contexts.push(admin.context);
    await approveProfileByName(admin.page, hospital.name);
    await approveProfileByName(admin.page, artist.name);

    const hospitalSession = await loginAsNewSession(browser, hospital);
    contexts.push(hospitalSession.context);
    await publishSlotViaUi(hospitalSession.page, {
      title: slotTitle,
      description: "A quiet reading corner for patients.",
      scheduledAtLocal: futureDatetimeLocal(12),
      durationMinutes: 30,
      location: "Ward 5 library nook",
    });

    const artistSession = await loginAsNewSession(browser, artist);
    contexts.push(artistSession.context);
    await proposeActivityViaUi(
      artistSession.page,
      slotTitle,
      "I can read aloud for half an hour, twice a week.",
    );

    // The Hospital closes the Slot instead of deciding on the Proposal.
    await hospitalSession.page.goto("/hospital/slots");
    const card = slotCard(hospitalSession.page, slotTitle);
    await card.getByRole("button", { name: "Close slot" }).click();

    // The Slot is now `closed`: no Close button, no Approve/Reject buttons,
    // and the outstanding Proposal shows as `Rejected` (cascade, B2).
    await expect(card.getByText(/^Closed$/)).toBeVisible();
    await expect(card.getByRole("button", { name: "Close slot" })).toHaveCount(0);
    const proposalRow = card.locator("li").filter({ hasText: artist.name });
    await expect(proposalRow).toContainText("Rejected");
    await expect(proposalRow.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(proposalRow.getByRole("button", { name: "Reject" })).toHaveCount(0);

    // The Slot no longer accepts new Proposals: it disappears from the
    // Artist's open-slots listing entirely (`listOpenSlots` only returns
    // `open` Slots), so there is no UI path left to propose on it again.
    await artistSession.page.goto("/artist/slots");
    await expect(slotCard(artistSession.page, slotTitle)).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
