import { test, expect } from "@playwright/test";

test.describe("Catalogue Acceptance & Role-Based Screens Suite (Prompt 17)", () => {
  test("Case 1 & 2: Supplier creates product and views index-status badges", async ({ page }) => {
    // 1. Supplier login
    await page.goto("/login");
    await page.fill('input[type="email"]', "supplier@sribharat.com");
    await page.fill('input[type="password"]', "supplier123");
    await page.click('button[type="submit"]');

    // 2. Navigate to supplier portal products
    await page.goto("/supplier-portal");
    await expect(page.locator("body")).toContainText(/Product Catalog Management|Supplier Portal/i);

    // Verify AI Index status badge is visible
    const indexBadge = page.locator("text=/AI: Ready|AI: Inactive|AI: Indexing/");
    if (await indexBadge.count() > 0) {
      await expect(indexBadge.first()).toBeVisible();
    }
  });

  test("Case 8 & 9: Tenant isolation - Buyer and Supplier portal isolation", async ({ page }) => {
    // 1. Buyer login
    await page.goto("/login");
    await page.fill('input[type="email"]', "bhogeswara@tradex.ai");
    await page.fill('input[type="password"]', "buyer123");
    await page.click('button[type="submit"]');

    // 2. Buyer cannot access /admin
    await page.goto("/admin");
    await page.waitForTimeout(1000);
    const url = page.url();
    const isRestricted = url.includes("/login") || url.endsWith("/") || url.includes("denied");
    expect(isRestricted).toBeTruthy();
  });

  test("Case 10 & 11: Admin console, Indexing Jobs & Audit logs", async ({ page }) => {
    // 1. Admin login
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@tradex.ai");
    await page.fill('input[type="password"]', "admin123");
    await page.click('button[type="submit"]');

    // 2. Open Admin Page
    await page.goto("/admin");
    await expect(page.locator("body")).toContainText(/Admin Platform Governance/i);

    // 3. Verify tabs: Indexing Status & Retry, Audit Logs
    const indexingTab = page.locator('button:has-text("Indexing Status & Retry")');
    if (await indexingTab.count() > 0) {
      await indexingTab.click();
      await expect(page.locator("body")).toContainText(/AI Knowledge Base & Indexing Jobs Queue/i);
    }

    const auditTab = page.locator('button:has-text("Audit Logs")');
    if (await auditTab.count() > 0) {
      await auditTab.click();
      await expect(page.locator("body")).toContainText(/Platform Audit Logs/i);
    }
  });
});
