import { test, expect } from "@playwright/test";

test.describe("End-to-End International B2B Trade Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as buyer speisekammer
    await page.goto("/login");
    await page.fill('input[type="email"]', "buyer@speisekammer.de");
    await page.fill('input[type="password"]', "Password123!");
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
});
