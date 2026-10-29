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

  it("transition sends POST with status and notes", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success", current_status: "in_production" }),
    });
    const { ordersApi } = await import("../lib/api/orders");
    const result = await ordersApi.transition("order-id-1", {
      status: "in_production",
      notes: "Starting manufacturing",
    });
    expect(result.current_status).toBe("in_production");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/orders/order-id-1/transition",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("shipmentsApi", () => {
  it("list calls GET /api/v1/shipments", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ shipment_number: "EX2026-1024", container_number: "TCNU1234567" }], total: 1 }),
    });
    const { shipmentsApi } = await import("../lib/api/shipments");
    const result = await shipmentsApi.list();
    expect(result.items[0].shipment_number).toBe("EX2026-1024");
    expect(result.items[0].container_number).toBe("TCNU1234567");
  });

  it("get fetches shipment by id or number", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "ship-1",
        shipment_number: "EX2026-1024",
        vessel_or_flight: "MV Ocean Star",
      }),
    });
    const { shipmentsApi } = await import("../lib/api/shipments");
    const result = await shipmentsApi.get("EX2026-1024");
    expect(result.shipment_number).toBe("EX2026-1024");
    expect(result.vessel_or_flight).toBe("MV Ocean Star");
  });

  it("events fetches milestone event history", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: "ev-1", event_type: "PICKED_UP", status: "completed" },
      ],
    });
    const { shipmentsApi } = await import("../lib/api/shipments");
    const result: any = await shipmentsApi.events("EX2026-1024");
    expect(result).toHaveLength(1);
    expect(result[0].event_type).toBe("PICKED_UP");
  });

  it("simulateStep advances maritime waypoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "moved", step_index: 3, waypoint_name: "Bab-el-Mandeb" }),
    });
    const { shipmentsApi } = await import("../lib/api/shipments");
    const result = await shipmentsApi.simulateStep("EX2026-1024");
    expect(result.status).toBe("moved");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/shipments/EX2026-1024/simulate-step",
      expect.objectContaining({ method: "POST" })
    );
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