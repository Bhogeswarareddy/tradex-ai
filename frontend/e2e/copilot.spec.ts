import { test, expect } from "@playwright/test";

test.describe("AI Trade Copilot & RAG Knowledge Engine", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "bhogeswara@tradex.ai");
    await page.fill('input[type="password"]', "buyer123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });

  test("Copilot page displays trade guides and handles compliance queries", async ({ page }) => {
    await page.goto("/copilot");
    await expect(page.locator("body")).toContainText(/Copilot|Incoterms|Trade Guides|Compliance/i);

    // Check if query input is available
    const copilotInput = page.locator('input[placeholder*="Ask"], textarea[placeholder*="Ask"]').first();
    await expect(copilotInput).toBeVisible();

    // Ask Incoterms question
    await copilotInput.fill("What is the risk transfer point under CIF Incoterms 2020?");
    await copilotInput.press("Enter");

    // Wait for response with citation badges
    await expect(page.locator("body")).toContainText(/Incoterms|CIF|risk|vessel/i, { timeout: 15000 });
  });
});
