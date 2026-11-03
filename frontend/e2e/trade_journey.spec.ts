import { test, expect } from "@playwright/test";

test.describe("End-to-End International B2B Trade Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as buyer speisekammer
    await page.goto("/login");
    await page.fill('input[type="email"]', "bhogeswara@tradex.ai");
    await page.fill('input[type="password"]', "buyer123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });

  test("Natural Language AI Search for organic turmeric", async ({ page }) => {
    await page.goto("/search");
    const searchInput = page.locator('input[placeholder*="Search"], textarea[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();

    // Type the canonical trade prompt
    const prompt = "Looking for 20 MT organic turmeric powder with curcumin > 5% for shipment to Hamburg";
    await searchInput.fill(prompt);
    await searchInput.press("Enter");

    // Verify search results or matched supplier cards appear
    await expect(page.locator("body")).toContainText(/Turmeric|Spice|Kerala|Curcumin/i);
  });

  test("RFQ management and quote comparison with landed cost", async ({ page }) => {
    await page.goto("/rfqs");
    await expect(page.locator("body")).toContainText(/RFQ|Request for Quotation/i);

    // Click on seeded RFQ if visible
    const rfqRow = page.locator('a[href*="/rfq/"]').first();
    if (await rfqRow.isVisible()) {
      await rfqRow.click();
      await expect(page.locator("body")).toContainText(/Quotation|Landed Cost|Incoterm/i);
    }
  });

  test("Shipments live tracking & maritime route inspection", async ({ page }) => {
    await page.goto("/shipments");
    await expect(page.locator("body")).toContainText(/Shipment|EX2026|Carrier|Vessel/i);

    // Navigate to shipment detail
    const shipmentLink = page.locator('a[href*="/shipments/"]').first();
    if (await shipmentLink.isVisible()) {
      await shipmentLink.click();
      await expect(page.locator("body")).toContainText(/Tracking|Status|ETA|Port/i);
    }
  });

  test("Document Intelligence upload and extraction center", async ({ page }) => {
    await page.goto("/documents");
    await expect(page.locator("body")).toContainText(/Document|Invoice|Bill of Lading|Extraction/i);
  });

  test("Market Intelligence time-series analytics", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.locator("body")).toContainText(/Market Intelligence|Price Trends|Demand/i);
  });

  test("Profile and Settings preferences management", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("body")).toContainText(/Settings|Preferences|Notifications/i);
    await page.goto("/profile");
    await expect(page.locator("body")).toContainText(/Profile|Speisekammer|bhogeswara/i);
  });

  test("AI Search non-turmeric agricultural query", async ({ page }) => {
    await page.goto("/search");
    const searchInput = page.locator('input[placeholder*="Search"], textarea[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("10 MT Grade A Green Cardamom 8mm for shipment to Dubai CIF");
    await searchInput.press("Enter");
    await expect(page.locator("body")).toContainText(/Cardamom|Search Results|Found|MT|Grade|AI Search/i);
  });

  test("Products catalog exploration and detail inspection", async ({ page }) => {
    await page.goto("/products");
    await expect(page.locator("body")).toContainText(/Products|Catalog|Filter/i);
    const productLink = page.locator('a[href*="/products/"]').first();
    if (await productLink.isVisible()) {
      await productLink.click();
      await expect(page.locator("body")).toContainText(/Specifications|Supplier|Incoterm|Price/i);
    }
  });

  test("Orders and procurement tracking", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.locator("body")).toContainText(/Orders|Purchase Order|Status|PO-/i);
  });

  test("Saved Items and bookmarks inspection", async ({ page }) => {
    await page.goto("/saved");
    await expect(page.locator("body")).toContainText(/Saved|Bookmarks|Items/i);
  });

  test("Authorization Sweep and RBAC guard verification", async ({ page }) => {
    await page.goto("/admin");
    // RoleGuard displays "Access Restricted" and blocks admin features
    await expect(page.locator("body")).toContainText(/Access Restricted|requires admin privileges/i);
    await expect(page.locator("body")).not.toContainText(/Audit Log Viewer|Matching-Score Weights/i);
  });
});
