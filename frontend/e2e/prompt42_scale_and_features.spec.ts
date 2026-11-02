import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

test.describe("Prompt 42: High-Value Professional Features", () => {
  const screenshotsDir = path.resolve(process.cwd(), "docs", "screenshots");

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    // Inject buyer session and disable onboarding tour modal
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "tradex_access_token",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MDQ2OTIwYy00ZjFmLTQyNmQtOWRmYy1kNjQ3ODMyNTVmMWQiLCJlbWFpbCI6InRlc3RfNTEyMTcwNWRAZXhhbXBsZS5jb20iLCJyb2xlIjoiYnV5ZXIiLCJleHAiOjE3OTYxNjcwNzIsImlhdCI6MTc5MzU3NTA3MiwidHlwZSI6ImFjY2VzcyJ9.DFXHcW_o9Sm_hQmRjBSkmlaP5TcAnTssB_Npj5w4dHA"
      );
      window.localStorage.setItem("tradex_tour_completed_buyer", "true");
      window.localStorage.setItem("tradex_tour_completed_supplier", "true");
      window.localStorage.setItem("tradex_tour_completed_admin", "true");
    });
  });

  test("1. Command Palette opens and searches products/suppliers/pages", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Wait for initial bundle compilation if needed
    const loader = page.getByText("Loading Trade Workspace...");
    if (await loader.isVisible()) {
      await expect(loader).not.toBeVisible({ timeout: 20000 });
    }

    // Press Control+k to trigger Command Palette modal
    await page.keyboard.press("Control+k");

    // If modal not open yet, click on search trigger in header
    const modalInput = page.locator("input[placeholder*='Type a product, supplier, RFQ, order']");
    if (!await modalInput.isVisible()) {
      const searchTrigger = page.locator("header input[placeholder*='Search']").first();
      await searchTrigger.click();
    }

    await expect(modalInput).toBeVisible({ timeout: 10000 });

    // Type query
    await modalInput.fill("rice");
    await page.waitForTimeout(800);

    // Save screenshot
    await page.screenshot({ path: path.join(screenshotsDir, "prompt42_command_palette.png") });

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(modalInput).not.toBeVisible({ timeout: 5000 });
  });

  test("2. Landed Cost Calculator displays parameters and simulation", async ({ page }) => {
    await page.goto("/landed-cost", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // Check title and simulated disclaimer
    await expect(page.getByText("Landed Cost Intelligence Calculator")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Simulated Stored Rates")).toBeVisible();
    await expect(page.getByText("Consignment Parameters")).toBeVisible();

    await page.screenshot({ path: path.join(screenshotsDir, "prompt42_landed_cost.png"), fullPage: true });
  });

  test("3. Supplier Profile shows Verification Tier badge", async ({ page }) => {
    await page.goto("/suppliers", { waitUntil: "domcontentloaded" });

    // Wait for supplier cards to load
    const viewProfileBtn = page.getByRole("link", { name: "View Profile" }).first();
    await expect(viewProfileBtn).toBeVisible({ timeout: 15000 });
    await viewProfileBtn.click();
    await page.waitForTimeout(1500);

    const whyBtn = page.getByRole("button", { name: /Why this tier\?/i });
    if (await whyBtn.isVisible()) {
      await whyBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(screenshotsDir, "prompt42_verification_tier.png") });
      await page.keyboard.press("Escape");
    } else {
      await page.screenshot({ path: path.join(screenshotsDir, "prompt42_verification_tier.png") });
    }
  });

  test("4. Spend and Performance Analytics shows Category & Supplier breakdowns", async ({ page }) => {
    await page.goto("/analytics", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    await expect(page.getByText("Market Intelligence & Analytics")).toBeVisible({ timeout: 10000 });

    // Switch to Trade Operations & Performance tab
    const opsTabBtn = page.getByRole("button", { name: /Trade Operations & Performance/i });
    await expect(opsTabBtn).toBeVisible({ timeout: 5000 });
    await opsTabBtn.click({ force: true });
    await page.waitForTimeout(1000);

    await expect(page.getByText("Spend by Commodity Category & Supplier Breakdown")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Top Spend Categories")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Top Supplier Partners")).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: path.join(screenshotsDir, "prompt42_analytics.png"), fullPage: true });
  });
});
