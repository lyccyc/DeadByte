import { expect, test } from "@playwright/test";

const MAPPING = [
  ["antarctica", "Antarctica", "Memory Forensics"],
  ["north-america", "North America", "Disk Forensics"],
  ["south-america", "South America", "Mobile Forensics"],
  ["europe", "Europe", "Network Forensics"],
  ["africa", "Africa", "Browser Forensics"],
  ["asia", "Asia", "Cloud Forensics"],
  ["oceania", "Oceania", "File & Artifact Analysis"],
] as const;

test.describe("landing page", () => {
  test("shows brand, tagline and a working primary CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nothing Deleted.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nothing Forgotten.");
    await expect(page.getByText("CASE STATUS: INVESTIGATING")).toBeVisible();
    await expect(page.getByRole("link", { name: "DeadByte home" })).toBeVisible();

    await page.getByTestId("cta-start").click();
    await expect(page).toHaveURL(/#map$/);
    await expect(page.getByTestId("world-map")).toBeInViewport();
  });

  test("labels demo content honestly", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("DEMO MODE")).toBeVisible();
    await expect(page.getByText("Demo catalogue").first()).toBeVisible();
  });
});

test.describe("global evidence map", () => {
  for (const [slug, name, domain] of MAPPING) {
    test(`clicking ${name} opens ${domain}`, async ({ page }) => {
      await page.goto("/");
      const continent = page.locator(`[data-region="${slug}"]`);
      await expect(continent).toHaveAttribute("aria-label", new RegExp(`^${name}: ${domain}`));
      // Click where a user would: on the continent at its map marker.
      const marker = page.locator(`[data-marker="${slug}"]`);
      await marker.scrollIntoViewIfNeeded();
      const box = await marker.boundingBox();
      if (!box) throw new Error(`marker for ${slug} not rendered`);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page).toHaveURL(`/regions/${slug}`);
      await expect(page.getByTestId("region-domain")).toHaveText(domain);
    });
  }

  test("continents are keyboard reachable and open with Enter and Space", async ({ page }) => {
    await page.goto("/");
    const antarctica = page.locator('[data-region="antarctica"]');
    await antarctica.focus();
    await expect(page.getByTestId("map-readout")).toContainText("Memory Forensics");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/regions/antarctica");

    await page.goto("/");
    await page.locator('[data-region="oceania"]').focus();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL("/regions/oceania");
    await expect(page.getByTestId("region-domain")).toHaveText("File & Artifact Analysis");
  });

  test("hover shows region, domain and challenge count", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-region="europe"]').hover();
    const readout = page.getByTestId("map-readout");
    await expect(readout).toContainText("Europe");
    await expect(readout).toContainText("Network Forensics");
    await expect(readout).toContainText(/\d+ published case/);
  });

  test("region cards link to every region", async ({ page }) => {
    await page.goto("/");
    for (const [slug, , domain] of MAPPING) {
      await expect(page.getByTestId(`region-card-${slug}`)).toContainText(domain);
      await expect(page.getByTestId(`region-card-${slug}`)).toHaveAttribute("href", `/regions/${slug}`);
    }
  });
});

test.describe("regions and challenges", () => {
  test("unknown region returns 404", async ({ page }) => {
    const res = await page.goto("/regions/atlantis");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("EVIDENCE NOT FOUND")).toBeVisible();
  });

  test("draft and archived challenges are not reachable", async ({ page, request }) => {
    expect((await page.goto("/challenges/unreleased-draft-case"))?.status()).toBe(404);
    expect((await page.goto("/challenges/retired-archived-case"))?.status()).toBe(404);
    expect((await request.get("/api/v1/challenges/unreleased-draft-case")).status()).toBe(404);
    const list = await (await request.get("/api/v1/challenges")).json();
    const slugs = list.data.map((c: { slug: string }) => c.slug);
    expect(slugs).not.toContain("unreleased-draft-case");
    expect(slugs).not.toContain("retired-archived-case");
  });

  test("region page filters by difficulty", async ({ page }) => {
    await page.goto("/regions/antarctica");
    await expect(page.getByTestId("challenge-card")).toHaveCount(2);
    await page.getByRole("button", { name: "Insane" }).click();
    await expect(page.getByTestId("challenge-card")).toHaveCount(1);
    await expect(page.getByTestId("challenge-card")).toContainText("Glacier Injection");
    await page.getByRole("button", { name: "Medium" }).click();
    await expect(page.getByTestId("empty-state")).toBeVisible();
  });

  test("challenge browser filters persist in the URL", async ({ page }) => {
    await page.goto("/challenges");
    await page.getByLabel("Region", { exact: true }).selectOption("europe");
    await expect(page).toHaveURL(/region=europe/);
    await expect(page.getByTestId("challenge-card")).toHaveCount(1);
    await expect(page.getByTestId("challenge-card")).toContainText("Packets Never Lie");

    await page.goto("/challenges?q=nonexistent-term");
    await expect(page.getByTestId("empty-state")).toBeVisible();
  });

  test("challenge detail shows metadata and honestly disabled actions", async ({ page }) => {
    await page.goto("/challenges/the-frozen-memory");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Frozen Memory");
    await expect(page.getByText("Antarctica · Memory Forensics").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /DOWNLOAD EVIDENCE/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /VERIFY FLAG/ })).toBeDisabled();
    await expect(page.getByLabel("Flag", { exact: true })).toBeDisabled();
  });

  test("API rejects invalid filters", async ({ request }) => {
    const res = await request.get("/api/v1/challenges?region=atlantis");
    expect(res.status()).toBe(400);
    const regions = await (await request.get("/api/v1/regions")).json();
    expect(regions.data.map((r: { forensicDomain: string }) => r.forensicDomain)).toEqual(MAPPING.map((m) => m[2]));
  });

  test("leaderboard shows no fake players", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.getByTestId("leaderboard-empty")).toBeVisible();
  });
});
