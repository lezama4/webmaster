import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Automated WCAG 2.x A/AA scan of every public page, so the a11y work (skip
// link, named nav, form errors, contrast) cannot regress. Locale is forced to
// English by playwright.config.ts's storageState.
// axe only detects roughly 30-40% of WCAG issues: it complements, and never
// replaces, the keyboard/screen-reader checks in accessibility.spec.ts and
// manual review.
const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const publicPages = [
  { name: "home", path: "/" },
  { name: "events", path: "/events" },
  {
    name: "find your moment",
    path: "/encuentra-tu-momento",
    // KNOWN FINDING #83 (wcag22aa target-size): overlapping map pins in
    // HospitalMap.tsx. Only that rule is skipped, only on the pins; every other
    // rule still scans them. Remove once #83 is fixed.
    skipRuleOn: {
      rule: "target-size",
      selector: '[data-testid="hospital-pin"]',
    },
  },
  { name: "about", path: "/quienes-somos" },
  { name: "help", path: "/ayuda" },
  { name: "login", path: "/login" },
  { name: "register", path: "/register" },
  { name: "404", path: "/this-page-does-not-exist" },
];

async function scan(page: Page, skipRuleOn?: { rule: string; selector: string }) {
  const builder = new AxeBuilder({ page }).withTags(wcagTags);
  if (skipRuleOn) builder.disableRules([skipRuleOn.rule]);
  const violations = [...(await builder.analyze()).violations];
  if (skipRuleOn) {
    // Re-run the skipped rule on everything except the scoped selector.
    const scoped = await new AxeBuilder({ page })
      .withRules([skipRuleOn.rule])
      .exclude(skipRuleOn.selector)
      .analyze();
    violations.push(...scoped.violations);
  }
  return violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }));
}

// Desktop (the default viewport) plus the two phone widths where the header
// collapses into the Menu button.
const viewports = [
  { label: "desktop", size: null },
  { label: "375px", size: { width: 375, height: 812 } },
  { label: "412px", size: { width: 412, height: 915 } },
];

for (const { label, size } of viewports) {
  for (const { name, path, skipRuleOn } of publicPages) {
    test(`${name} page has no WCAG A/AA axe violations (${label})`, async ({ page }) => {
      if (size) await page.setViewportSize(size);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await scan(page, skipRuleOn)).toEqual([]);
    });
  }

  if (size) {
    test(`home page has no WCAG A/AA axe violations with the menu open (${label})`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });
  }
}
