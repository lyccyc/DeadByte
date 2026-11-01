import { expect, test } from "@playwright/test";

/**
 * Runs against the demo-mode build used in CI (no Supabase variables).
 * Protected endpoints must fail closed — never pretend to succeed.
 */
test.describe("protected endpoints fail closed without a backend", () => {
  test("flag submission is rejected and never reports success", async ({ request }) => {
    const res = await request.post("/api/v1/challenges/4f1b2c3d-1234-4abc-8def-0123456789ab/submit", {
      data: { flag: "DEADBYTE{guess}" },
    });
    expect(res.status()).toBe(503);
    const body = await res.json();
    expect(body.correct).toBeUndefined();
    expect(body.error.code).toBe("not_configured");
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("admin API is unavailable", async ({ request }) => {
    expect((await request.get("/api/v1/admin/challenges")).status()).toBe(503);
    const create = await request.post("/api/v1/admin/challenges", {
      data: { slug: "x", region: "europe", title: "x", difficulty: "easy", points: 1 },
    });
    expect(create.status()).toBe(503);
  });

  test("personal APIs are unavailable", async ({ request }) => {
    expect((await request.get("/api/v1/me/progress")).status()).toBe(503);
    expect((await request.get("/api/v1/me/submissions")).status()).toBe(503);
    expect((await request.get("/api/v1/leaderboard")).status()).toBe(503);
  });

  test("admin pages show an access notice instead of tools", async ({ page }) => {
    await page.goto("/admin/challenges");
    await expect(page.getByTestId("admin-denied")).toBeVisible();
    await expect(page.getByTestId("admin-row")).toHaveCount(0);
  });

  test("demo challenge pages offer no working flag form", async ({ page }) => {
    await page.goto("/challenges/the-frozen-memory");
    await expect(page.getByTestId("flag-submit")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /verify flag/i })).toBeDisabled();
  });

  test("auth forms are disabled", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "SIGN IN" })).toBeDisabled();
    await page.goto("/register");
    await expect(page.getByRole("button", { name: "CREATE ACCOUNT" })).toBeDisabled();
  });
});
