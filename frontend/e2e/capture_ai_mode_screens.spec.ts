import { test, expect } from "@playwright/test";
import path from "path";

test.describe("AI Mode Responsive Screens Capture", () => {
  test("Capture AI Mode at 1440, 1024, 768, and 390 px", async ({ page }) => {
    // 1. Mock Auth & User
    await page.addInitScript(() => {
      localStorage.setItem("tradex_access_token", "mock-token-buyer");
      localStorage.setItem("tradex_refresh_token", "mock-refresh-buyer");
      localStorage.setItem(
        "tradex_user",
        JSON.stringify({
          id: "u-buyer-1",
          email: "buyer@tradex.ai",
          fullName: "Alex Mercer",
          role: "buyer",
          companyName: "Nexus Global Import Ltd",
        })
      );
    });

    // 2. Intercept API routes
    await page.route("**/api/v1/auth/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-token-buyer",
          refresh_token: "mock-refresh-buyer",
          user: {
            id: "u-buyer-1",
            email: "buyer@tradex.ai",
            fullName: "Alex Mercer",
            role: "buyer",
            companyName: "Nexus Global Import Ltd",
          },
        }),
      });
    });

    await page.route("**/api/v1/notifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0 }),
      });
    });

    const mockConversations = [
      {
        id: "conv-today-1",
        title: "Consumer Electronics & Laptops Sourcing",
        search_state: { query: "laptops" },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages_count: 3,
        selected_count: 2,
      },
      {
        id: "conv-yest-1",
        title: "Organic Turmeric Bulk Hamburg",
        search_state: { query: "turmeric" },
        created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        messages_count: 4,
        selected_count: 1,
      },
      {
        id: "conv-earlier-1",
        title: "Industrial Solar Inverter RFQ",
        search_state: { query: "solar inverters" },
        created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        messages_count: 2,
        selected_count: 0,
      },
    ];

    const mockCards = [
      {
        product_id: "prod-101",
        title: "ProBook Ultrathin 15.6'' IPS Laptop, Intel Core i7",
        supplier_id: "sup-01",
        supplier_name: "Shenzhen Horizon Microelectronics",
        origin_country: "China",
        unit_price: 435.0,
        price_status: "CURRENT",
        currency: "USD",
        price_tiers: [
          { min_quantity: 50, unit_price: 435.0 },
          { min_quantity: 200, unit_price: 410.0 },
        ],
        moq: 50,
        supplier_verification: true,
        certifications: ["CE", "FCC", "RoHS"],
        lead_time_days: 14,
        match_explanation: {
          matched: ["Direct factory pricing", "Tier pricing under $450 target", "North America / EU spec"],
          unmatched: ["Standard ocean shipping: 25 days transit"],
        },
      },
      {
        product_id: "prod-102",
        title: "Commercial High-Efficiency Solar Inverter 50kW Grid-Tied",
        supplier_id: "sup-02",
        supplier_name: "Bavaria Power Systems GmbH",
        origin_country: "Germany",
        unit_price: 3200.0,
        price_status: "CURRENT",
        currency: "EUR",
        price_tiers: [{ min_quantity: 5, unit_price: 3200.0 }],
        moq: 5,
        supplier_verification: true,
        certifications: ["TUV Rheinland", "CE", "ISO 9001"],
        lead_time_days: 21,
        match_explanation: {
          matched: ["Verified EU Manufacturer", "Full warranty & compliance documentation"],
          unmatched: [],
        },
      },
      {
        product_id: "prod-103",
        title: "Certified Organic Salem Turmeric Powder 5% Curcumin",
        supplier_id: "sup-03",
        supplier_name: "Kerala Harvest Spices Pvt Ltd",
        origin_country: "India",
        unit_price: 1.85,
        price_status: "CURRENT",
        currency: "USD",
        price_tiers: [
          { min_quantity: 1000, unit_price: 1.85 },
          { min_quantity: 5000, unit_price: 1.65 },
        ],
        moq: 1000,
        supplier_verification: true,
        certifications: ["USDA Organic", "ISO 22000", "HACCP"],
        lead_time_days: 10,
        match_explanation: {
          matched: ["Verified export grade", "Lab tested curcumin >= 5%", "Phytosanitary inspection ready"],
          unmatched: [],
        },
      },
    ];

    const mockDetail = {
      id: "conv-today-1",
      title: "Consumer Electronics & Laptops Sourcing",
      search_state: { query: "laptops" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [
        {
          id: "msg-1",
          conversation_id: "conv-today-1",
          role: "user",
          content: "Find affordable enterprise laptops and verified suppliers with CE certification for USA delivery.",
          provider: "openai",
          is_demo: false,
          created_at: new Date(Date.now() - 60000).toISOString(),
        },
        {
          id: "msg-2",
          conversation_id: "conv-today-1",
          role: "assistant",
          content:
            "I've searched TradeX verified supplier database and filtered verified listings with confirmed CE & RoHS certifications. Below are the top matches with live contract pricing and current MOQ terms.",
          provider: "gemini",
          is_demo: false,
          structured: {
            classification: "new_search",
            criteria: { product: "laptops", certifications: ["CE"], destination: "USA" },
            clarifying_question: "Do you require custom logo engraving or pre-installed OS images on orders over 100 units?",
            product_cards: mockCards,
            follow_ups: [
              "Only show suppliers from China",
              "Compare the first two products",
              "What is the lead time for 200 units?",
              "Generate AI negotiation pitch for ProBook",
            ],
          },
          created_at: new Date(Date.now() - 30000).toISOString(),
        },
      ],
      selected_products: [mockCards[0], mockCards[1]],
    };

    await page.route("**/api/v1/ai-mode/conversations**", async (route) => {
      const url = route.request().url();
      if (url.endsWith("/conversations") && route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockConversations),
        });
      } else if (url.includes("/conversations/conv-today-1") && route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockDetail),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockConversations[0]),
        });
      }
    });

    const targetScreenshotsDir = path.resolve(process.cwd(), "../docs/screenshots/ai-mode");

    const viewports = [
      { name: "ai-mode-1440.png", width: 1440, height: 960 },
      { name: "ai-mode-1024.png", width: 1024, height: 800 },
      { name: "ai-mode-768.png", width: 768, height: 1024 },
      { name: "ai-mode-390.png", width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/ai-mode?id=conv-today-1", { waitUntil: "networkidle" });
      await page.waitForTimeout(1000); // Allow render stabilization

      const screenshotPath = path.join(targetScreenshotsDir, vp.name);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Saved screenshot: ${screenshotPath} at viewport ${vp.width}x${vp.height}`);
    }
  });
});
