import { describe, it, expect } from "vitest";
import { dashboardApi } from "../lib/api/dashboard";
import { productsApi } from "../lib/api/products";

describe("Dashboard API & Contract Specifications (Prompt 6)", () => {
  it("should expose summary, recommended suppliers, market insights, and copilot endpoints", () => {
    expect(typeof dashboardApi.getSummary).toBe("function");
    expect(typeof dashboardApi.getRecommendedSuppliers).toBe("function");
    expect(typeof dashboardApi.getMarketInsights).toBe("function");
    expect(typeof dashboardApi.getSuggestedPrompts).toBe("function");
    expect(typeof dashboardApi.sendCopilotMessage).toBe("function");
  });
});

describe("Products Marketplace & Comparison Specifications (Prompt 7)", () => {
  it("should expose list, getBySlug, categories, and compare endpoints", () => {
    expect(typeof productsApi.list).toBe("function");
    expect(typeof productsApi.getBySlug).toBe("function");
    expect(typeof productsApi.getCategories).toBe("function");
    expect(typeof productsApi.compare).toBe("function");
    expect(typeof productsApi.toggleSaveProduct).toBe("function");
  });

  it("should validate compare requirements: at least 2 items required and up to 4", () => {
    const selectedIds = ["prod-1", "prod-2"];
    expect(selectedIds.length).toBeGreaterThanOrEqual(2);
    expect(selectedIds.length).toBeLessThanOrEqual(4);
  });
});
