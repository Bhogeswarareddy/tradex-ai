import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyticsApi } from "../lib/api/analytics";

describe("analyticsApi client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("builds export URL with correct query parameters", () => {
    const url = analyticsApi.getExportUrl("market", "csv", {
      from: "2025-01-01",
      to: "2026-01-01",
      product: "Organic Turmeric",
    });

    expect(url).toContain("/api/v1/analytics/export?");
    expect(url).toContain("report=market");
    expect(url).toContain("format=csv");
    expect(url).toContain("from=2025-01-01");
    expect(url).toContain("to=2026-01-01");
    expect(url).toContain("product=Organic+Turmeric");
  });

  it("fetches top products with simulated label", async () => {
    const mockData = [
      {
        product: "Organic Turmeric",
        category: "Spices",
        total_volume: 12500,
        avg_price: 3.12,
        avg_demand: 128.5,
        label: "Simulated market data",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as any);

    const res = await analyticsApi.getTopProducts();
    expect(res).toHaveLength(1);
    expect(res[0].product).toBe("Organic Turmeric");
    expect(res[0].label).toBe("Simulated market data");
  });

  it("fetches AI insights successfully", async () => {
    const mockInsight = {
      insights: [
        "Organic Turmeric exhibits the fastest market growth with a +42.0% expansion.",
        "Basmati Rice demonstrated sustained momentum with +35.0% demand growth.",
        "Cotton Fibre saw a +28.0% demand index surge.",
      ],
      summary: "Positive commodity demand trends across key corridors.",
      source: "Simulated market data",
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockInsight,
    } as any);

    const res = await analyticsApi.getInsights({ product: "Organic Turmeric" });
    expect(res.insights).toHaveLength(3);
    expect(res.source).toBe("Simulated market data");
  });
});
