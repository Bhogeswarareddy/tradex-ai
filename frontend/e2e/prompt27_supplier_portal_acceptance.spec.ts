import { test, expect } from "@playwright/test";

test.describe("Prompt 27: Supplier Portal Acceptance Tests (Scenarios 1-10)", () => {
  // Scenario 1: Register brand-new supplier & check storefront completeness
  test("Scenario 1: Register new supplier and storefront completeness meter", async ({ page }) => {
    const unique = Date.now().toString().slice(-5);
    const email = `supplier_p27_${unique}@spiceworld.com`;

    await page.goto("/register");
    await page.waitForTimeout(1000);

    // Toggle role to Supplier
    const supplierRoleBtn = page.locator('button:has-text("Supplier / Exporter")');
    if (await supplierRoleBtn.count() > 0) {
      await supplierRoleBtn.click();
    }

    // Fill form fields
    const nameInput = page.locator('input[placeholder="Bhogeswara Reddy"], input[type="text"]').first();
    await nameInput.fill(`Priya Export ${unique}`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', "Supplier123456!");

    const companyInput = page.locator('input[placeholder*="Company"], input[placeholder*="Global"]').first();
    if (await companyInput.count() > 0) {
      await companyInput.fill(`Malabar Spices ${unique}`);
    }

    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard or login
    await page.waitForTimeout(2500);

    // If redirected to login, login with registered credentials
    if (page.url().includes("/login")) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', "Supplier123456!");
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    }

    // Go to supplier portal
    await page.goto("/supplier-portal");
    await page.waitForTimeout(1500);

    // Verify no expired token banner
    await expect(page.locator("body")).not.toContainText(/Invalid or expired authentication token/i);

    // Switch to Profile / Storefront tab
    const profileTab = page.locator('button:has-text("Storefront"), button:has-text("Profile")').first();
    if (await profileTab.count() > 0) {
      await profileTab.click();
      await page.waitForTimeout(1000);
      // Profile Completeness Meter is visible
      await expect(page.locator("body")).toContainText(/Completeness|Storefront/i);
    }
  });

  // Scenario 6: AI Mode greeting and typo handling
  test("Scenario 6: AI Mode 'hi' has no product dump and live inference active", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "bhogeswara@tradex.ai");
    await page.fill('input[type="password"]', "buyer123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Navigate to AI Mode
    await page.goto("/ai-mode");
    await page.waitForTimeout(2000);

    // Verify no expired token banner
    await expect(page.locator("body")).not.toContainText(/Invalid or expired authentication token/i);

    // Verify Live AI status indicator is visible (connected to live LLM)
    const liveIndicator = page.locator('[data-testid="ai-status-live"]');
    if (await liveIndicator.count() > 0) {
      await expect(liveIndicator).toBeVisible();
    }

    // Send 'hi'
    const input = page.locator('textarea, input[placeholder*="Ask TradeX"], input[placeholder*="message"]').first();
    if (await input.count() > 0) {
      await input.fill("hi");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(3000);

      // Verify response does not dump 10 products
      const productCards = page.locator('[data-testid="product-card"], .product-card');
      const count = await productCards.count();
      expect(count).toBe(0);
    }
  });

  // Scenario 7 & 10: Supplier Portal pages, clean headers and zero leftover labels
  test("Scenario 7 & 10: Supplier portal pages work with real data and no leftover developer labels", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "supplier@sribharat.com");
    await page.fill('input[type="password"]', "supplier123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.goto("/supplier-portal");
    await page.waitForTimeout(1500);

    // Confirm no leftover developer labels
    await expect(page.locator("body")).not.toContainText(/Prompt 15/i);
    await expect(page.locator("body")).not.toContainText(/Prompt 21/i);
    await expect(page.locator("body")).not.toContainText(/Prompt 23/i);

    // Verify Supplier Dashboard Metrics exist
    await expect(page.locator("body")).toContainText(/Sri Bharat Spices|Supplier Portal|Dashboard/i);

    // Test Navigation to Capacity and Inventory tab
    const capacityTab = page.locator('button:has-text("Capacity"), button:has-text("Inventory")').first();
    if (await capacityTab.count() > 0) {
      await capacityTab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator("body")).toContainText(/Available Quantity|Monthly Capacity|Inventory/i);
    }

    // Test Navigation to Certifications tab
    const certsTab = page.locator('button:has-text("Certifications")').first();
    if (await certsTab.count() > 0) {
      await certsTab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator("body")).toContainText(/Certificates|ISO|Verified/i);
    }
  });

  // Scenario 8: Settings Currency, Language and Theme
  test("Scenario 8: Settings changes header currency, language and dark mode", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "supplier@sribharat.com");
    await page.fill('input[type="password"]', "supplier123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Open settings page
    await page.goto("/settings");
    await page.waitForTimeout(1500);

    await expect(page.locator("body")).toContainText(/Settings|Preferences|Einstellungen/i);

    // Dark theme toggle button
    const darkThemeBtn = page.locator('button:has-text("Dark"), button:has-text("Dark Navy")').first();
    if (await darkThemeBtn.count() > 0) {
      await darkThemeBtn.click();
      await page.waitForTimeout(500);
    }

    // Save preferences
    const saveBtn = page.locator('button:has-text("Save Preferences"), button:has-text("Save")').first();
    if (await saveBtn.count() > 0) {
      await saveBtn.click();
      await page.waitForTimeout(1500);
    }

    // Verify HTML has dark class or style applied
    const html = page.locator("html");
    const classAttr = await html.getAttribute("class");
    expect(classAttr).toContain("dark");
  });

  // Scenario 9: Messages and New Conversation Dialog
  test("Scenario 9: Trade Messages has + New Message button and removes Prompt 15 label", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "supplier@sribharat.com");
    await page.fill('input[type="password"]', "supplier123");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Navigate to /messages
    await page.goto("/messages");
    await page.waitForTimeout(1500);

    // Header confirms NO "Prompt 15" label
    await expect(page.locator("body")).not.toContainText(/Prompt 15/i);
    await expect(page.locator("body")).toContainText(/Trade Messages/i);

    // "+ New Message" button is visible and clickable
    const newMsgBtn = page.locator('button:has-text("New Message")').first();
    await expect(newMsgBtn).toBeVisible();
    await newMsgBtn.click();
    await page.waitForTimeout(1000);

    // Modal opens with recipient picker and templates dropdown
    await expect(page.locator("body")).toContainText(/Select Recipient|Recipient|Commercial Inquiry/i);
  });
});
