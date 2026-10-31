import { expect, test } from "@playwright/test";

test.describe("mobile (375px)", () => {
  test("has no horizontal overflow on key pages", async ({ page }) => {
    for (const path of ["/", "/challenges", "/regions/antarctica", "/challenges/the-frozen-memory", "/login", "/leaderboard"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    }
  });

  test("menu opens, is labelled, navigates and closes", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Open menu" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("link", { name: "Challenges", exact: true }).last().click();
    await expect(page).toHaveURL("/challenges");
    await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape closes the menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  test("every region is reachable through large tappable cards", async ({ page }) => {
    await page.goto("/");
    const card = page.getByTestId("region-card-south-america");
    const box = await card.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await card.tap();
    await expect(page).toHaveURL("/regions/south-america");
    await expect(page.getByTestId("region-domain")).toHaveText("Mobile Forensics");
  });
});
