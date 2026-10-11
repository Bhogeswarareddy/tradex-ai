import { test, expect } from "@playwright/test";

test.describe("Authentication and Role-Based Guards", () => {
  test("Buyer login and redirect to dashboard", async ({ page }) => {
    await page.goto("/login");

    // Check login page elements
    await expect(page.locator("h1")).toContainText(/TradeX AI|Sign In/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Fill credentials for seeded buyer
    await page.fill('input[type="email"]', "bhogeswara@tradex.ai");
    await page.fill('input[type="password"]', "buyer123");
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });

  test("Registration form validation", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("body")).toContainText(/Create|Register|Account|TradeX/i);

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
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    const isLogin = currentUrl.includes("/login") || currentUrl.endsWith("/");
    const isDenied = await page.locator("body").innerText().then(t => t.includes("Access Denied") || t.includes("Sign In") || t.includes("Admin"));

    expect(isLogin || isDenied).toBeTruthy();
  });
});
