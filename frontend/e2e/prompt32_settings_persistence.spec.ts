import { test, expect } from "@playwright/test";

test.describe("Prompt 32: Settings, Theme, Language and Currency Persistence", () => {
  test("Scenario 1: Dark mode, Hindi and INR persist across navigation, refresh, and sign-out/sign-in", async ({
    page,
  }) => {
    // 1. Sign in as buyer
    await page.goto("/login");
    await page.fill('input[type="email"]', "bhogeswara@tradex.ai");
    await page.fill('input[type="password"]', "buyer123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 10000 });

    // 2. Open Settings page
    await page.goto("/settings");
    await page.waitForTimeout(1000);

    // 3. Select INR in currency dropdown
    const currencySelect = page.locator("select").first();
    await currencySelect.selectOption("INR");

    // 4. Select Hindi (HI) in language dropdown
    const languageSelect = page.locator("select").nth(1);
    await languageSelect.selectOption("HI");

    // 5. Select Dark mode card
    const darkThemeCard = page.locator('[data-testid="theme-dark-btn"]').first();
    await darkThemeCard.click();

    // 6. Click Save Preferences
    const saveBtn = page.locator('[data-testid="save-preferences-btn"]').first();
    await saveBtn.click();
    await page.waitForTimeout(1500);

    // Verify HTML has dark class
    const htmlElem = page.locator("html");
    await expect(htmlElem).toHaveClass(/dark/);
    await expect(htmlElem).toHaveAttribute("data-theme", "dark");

    // Verify header reflects INR and HI
    await expect(page.locator("header")).toContainText(/INR/);
    await expect(page.locator("header")).toContainText(/HI/);

    // 7. Navigate to AI Mode (/ai-mode)
    await page.goto("/ai-mode");
    await page.waitForTimeout(1000);
    await expect(htmlElem).toHaveClass(/dark/);
    // Currency in AI Mode header pill
    await expect(page.locator("body")).toContainText(/INR/);

    // 8. Navigate to Products (/products)
    await page.goto("/products");
    await page.waitForTimeout(1000);
    await expect(htmlElem).toHaveClass(/dark/);
    // Product prices show converted INR with symbol or approx
    await expect(page.locator("body")).toContainText(/₹|INR/);

    // 9. Navigate to Messages (/messages)
    await page.goto("/messages");
    await page.waitForTimeout(1000);
    await expect(htmlElem).toHaveClass(/dark/);

    // 10. Refresh the browser
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify dark mode persisted immediately without flash
    await expect(htmlElem).toHaveClass(/dark/);
    await expect(page.locator("header")).toContainText(/INR/);
    await expect(page.locator("header")).toContainText(/HI/);

    // 11. Reopen Settings
    await page.goto("/settings");
    await page.waitForTimeout(1000);
    await expect(currencySelect).toHaveValue("INR");
    await expect(languageSelect).toHaveValue("HI");
    await expect(htmlElem).toHaveClass(/dark/);
    // Verify no unsaved changes banner
    await expect(page.locator("body")).not.toContainText(/You have unsaved changes|आपके पास बिना सहेजे गए परिवर्तन हैं/i);

    // 12. Sign out
    const profileBtn = page.locator('header button[title*="Account"], header button:has-text("Bhogeswara"), header button img').first();
    if (await profileBtn.count() > 0) {
      await profileBtn.click();
      const logoutBtn = page.locator('button:has-text("Sign Out"), button:has-text("Log out"), button:has-text("लॉग आउट")').first();
      await logoutBtn.click();
    } else {
      await page.goto("/login");
    }
    await page.waitForURL(/\/login/, { timeout: 10000 });

    // 13. Sign in again
    await page.fill('input[type="email"]', "bhogeswara@tradex.ai");
    await page.fill('input[type="password"]', "buyer123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 10000 });

    // 14. Verify persisted everywhere
    await expect(htmlElem).toHaveClass(/dark/);
    await expect(page.locator("header")).toContainText(/INR/);
    await expect(page.locator("header")).toContainText(/HI/);

    await page.goto("/settings");
    await page.waitForTimeout(1000);
    await expect(currencySelect).toHaveValue("INR");
    await expect(languageSelect).toHaveValue("HI");
    await expect(htmlElem).toHaveClass(/dark/);
  });

  test("Scenario 2: Light mode, German and EUR persist across navigation, refresh, and sign-out/sign-in", async ({
    page,
  }) => {
    // 1. Sign in as buyer
    await page.goto("/login");
    await page.fill('input[type="email"]', "bhogeswara@tradex.ai");
    await page.fill('input[type="password"]', "buyer123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 10000 });

    // 2. Open Settings page
    await page.goto("/settings");
    await page.waitForTimeout(1000);

    // 3. Select EUR in currency dropdown
    const currencySelect = page.locator("select").first();
    await currencySelect.selectOption("EUR");

    // 4. Select German (DE) in language dropdown
    const languageSelect = page.locator("select").nth(1);
    await languageSelect.selectOption("DE");

    // 5. Select Light mode card
    const lightThemeCard = page.locator('[data-testid="theme-light-btn"]').first();
    await lightThemeCard.click();

    // 6. Click Save Preferences
    const saveBtn = page.locator('[data-testid="save-preferences-btn"]').first();
    await saveBtn.click();
    await page.waitForTimeout(1500);

    // Verify HTML does not have dark class
    const htmlElem = page.locator("html");
    await expect(htmlElem).not.toHaveClass(/dark/);
    await expect(htmlElem).toHaveAttribute("data-theme", "light");

    // Verify header reflects EUR and DE
    await expect(page.locator("header")).toContainText(/EUR/);
    await expect(page.locator("header")).toContainText(/DE/);

    // 7. Navigate to AI Mode (/ai-mode)
    await page.goto("/ai-mode");
    await page.waitForTimeout(1000);
    await expect(htmlElem).not.toHaveClass(/dark/);
    await expect(page.locator("body")).toContainText(/EUR/);

    // 8. Navigate to Products (/products)
    await page.goto("/products");
    await page.waitForTimeout(1000);
    await expect(htmlElem).not.toHaveClass(/dark/);
    await expect(page.locator("body")).toContainText(/€|EUR/);

    // 9. Navigate to Messages (/messages)
    await page.goto("/messages");
    await page.waitForTimeout(1000);
    await expect(htmlElem).not.toHaveClass(/dark/);

    // 10. Refresh the browser
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify light mode persisted
    await expect(htmlElem).not.toHaveClass(/dark/);
    await expect(page.locator("header")).toContainText(/EUR/);
    await expect(page.locator("header")).toContainText(/DE/);

    // 11. Reopen Settings
    await page.goto("/settings");
    await page.waitForTimeout(1000);
    await expect(currencySelect).toHaveValue("EUR");
    await expect(languageSelect).toHaveValue("DE");
    await expect(htmlElem).not.toHaveClass(/dark/);
    await expect(page.locator("body")).not.toContainText(/Unsaved changes|Ungespeicherte Änderungen/i);

    // 12. Sign out
    const profileBtn = page.locator('header button[title*="Account"], header button:has-text("Bhogeswara"), header button img').first();
    if (await profileBtn.count() > 0) {
      await profileBtn.click();
      const logoutBtn = page.locator('button:has-text("Sign Out"), button:has-text("Abmelden")').first();
      await logoutBtn.click();
    } else {
      await page.goto("/login");
    }
    await page.waitForURL(/\/login/, { timeout: 10000 });

    // 13. Sign in again
    await page.fill('input[type="email"]', "bhogeswara@tradex.ai");
    await page.fill('input[type="password"]', "buyer123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 10000 });

    // 14. Verify persisted everywhere
    await expect(htmlElem).not.toHaveClass(/dark/);
    await expect(page.locator("header")).toContainText(/EUR/);
    await expect(page.locator("header")).toContainText(/DE/);

    await page.goto("/settings");
    await page.waitForTimeout(1000);
    await expect(currencySelect).toHaveValue("EUR");
    await expect(languageSelect).toHaveValue("DE");
    await expect(htmlElem).not.toHaveClass(/dark/);
  });
});
