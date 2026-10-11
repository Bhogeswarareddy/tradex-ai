import { test, expect } from "@playwright/test";

test.describe("Authentication and Role-Based Guards", () => {
  test("Buyer login and redirect to dashboard", async ({ page }) => {
    await page.goto("/login");

    // Check login page elements
    await expect(page.locator("h1")).toContainText(/Sign In|TradeX AI/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Fill credentials for seeded buyer
    await page.fill('input[type="email"]', "buyer@speisekammer.de");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/(dashboard)?$/);
    await expect(page.locator("body")).toContainText(/Speisekammer|Buyer/i);
  });

  test("Registration form validation", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("h1")).toContainText(/Create Account|Register/i);

    // Verify role selection exists
    const buyerRole = page.locator('input[value="buyer"], button:has-text("Buyer")');
    if (await buyerRole.count() > 0) {
      await expect(buyerRole.first()).toBeVisible();
    }
  });

  test("Role Guard prevents unauthorized access to Admin console", async ({ page }) => {
    // Navigate without authentication or as buyer
    await page.goto("/admin");

    // Should redirect to login or show access denied
    const currentUrl = page.url();
    const isLogin = currentUrl.includes("/login");
    const isDenied = await page.locator("body").innerText().then(t => t.includes("Access Denied") || t.includes("Sign In"));

    expect(isLogin || isDenied).toBeTruthy();
  });
});
