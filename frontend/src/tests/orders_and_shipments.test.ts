import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch & localStorage globally
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

const mockStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => {
    mockStorage[k] = v;
  },
  removeItem: (k: string) => {
    delete mockStorage[k];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  },
  length: 0,
  key: () => null,
} as any;

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.localStorage.setItem("tradex_access_token", "test-token");
});

describe("ordersApi", () => {
  it("list calls GET /api/v1/orders", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    });
    const { ordersApi } = await import("../lib/api/orders");
    const result = await ordersApi.list();
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/orders", expect.any(Object));
    expect(result.items).toEqual([]);
  });

  it("simulatePayment sends POST with payment_type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ simulated: true, status: "success" }),
    });
    const { ordersApi } = await import("../lib/api/orders");
    const result = await ordersApi.simulatePayment("order-id-1", { payment_type: "advance" });
    expect(result.simulated).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/orders/order-id-1/payments/simulate",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("tradeFinanceOverview returns simulated=true", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        simulated: true,
        banner: "Trade Finance is simulated for this project",
        credit_facility: {},
        balances: {},
        transactions: [],
      }),
    });
    const { ordersApi } = await import("../lib/api/orders");
    const result = await ordersApi.tradeFinanceOverview();
    expect(result.simulated).toBe(true);
    expect(result.banner).toContain("simulated");
  });
});

describe("shipmentsApi", () => {
  it("list calls GET /api/v1/shipments", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ shipment_number: "EX2026-1024" }], total: 1 }),
    });
    const { shipmentsApi } = await import("../lib/api/shipments");
    const result = await shipmentsApi.list();
    expect(result.items[0].shipment_number).toBe("EX2026-1024");
  });

  it("aiSummary sends POST to ai endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ summary: "On track", delay_risk_level: "LOW" }),
    });
    const { shipmentsApi } = await import("../lib/api/shipments");
    const result = await shipmentsApi.aiSummary("ship-id-1");
    expect(result.delay_risk_level).toBe("LOW");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai/shipments/ship-id-1/summary",
      expect.objectContaining({ method: "POST" })
    );
  });
});