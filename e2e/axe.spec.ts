import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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

for (const { name, path, skipRuleOn } of publicPages) {
  test(`${name} page has no WCAG A/AA axe violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const scan = new AxeBuilder({ page }).withTags(wcagTags);
    if (skipRuleOn) scan.disableRules([skipRuleOn.rule]);
    const violations = [...(await scan.analyze()).violations];
    if (skipRuleOn) {
      // Re-run the skipped rule on everything except the scoped selector.
      const scoped = await new AxeBuilder({ page })
        .withRules([skipRuleOn.rule])
        .exclude(skipRuleOn.selector)
        .analyze();
      violations.push(...scoped.violations);
    }
    expect(
      violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  });
}
