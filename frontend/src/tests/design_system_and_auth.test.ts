import { describe, it, expect } from "vitest";
import { NAV_ITEMS } from "../components/layout/Sidebar";
import { authApi } from "../lib/api/auth";

describe("TradeX Navigation Specification (Prompt 5)", () => {
  it("should have exactly 13 ordered navigation items", () => {
    expect(NAV_ITEMS).toHaveLength(13);

    const expectedOrder = [
      "Home",
      "AI Search",
      "Products",
      "Suppliers",
      "RFQ Marketplace",
      "Orders",
      "Shipments",
      "Trade Finance",
      "Documents",
      "Analytics",
      "Messages",
      "Saved",
      "Settings",
    ];

    const actualOrder = NAV_ITEMS.map((item) => item.name);
    expect(actualOrder).toEqual(expectedOrder);
  });

  it("should have unread badge on Messages and simulated flag on Trade Finance", () => {
    const messagesItem = NAV_ITEMS.find((item) => item.name === "Messages");
    expect(messagesItem).toBeDefined();
    expect(messagesItem?.badge).toBe(3);

    const financeItem = NAV_ITEMS.find((item) => item.name === "Trade Finance");
    expect(financeItem).toBeDefined();
    expect(financeItem?.simulated).toBe(true);
  });
});

describe("Auth Client & Token Storage (Prompt 4)", () => {
  it("should handle access token storage and retrieval cleanly", () => {
    authApi.setAccessToken(null);
    expect(authApi.getAccessToken()).toBeNull();

    authApi.setAccessToken("test_mock_jwt_token_123");
    expect(authApi.getAccessToken()).toBe("test_mock_jwt_token_123");

    authApi.setAccessToken(null);
    expect(authApi.getAccessToken()).toBeNull();
  });
});
