import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminApi } from "../lib/api/admin";

describe("adminApi client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches admin overview metrics", async () => {
    const mockOverview = {
      total_users: 120,
      total_orders: 45,
      cumulative_trade_value_eur: 1540000,
      pending_supplier_verifications: 3,
      system_status: "operational",
      last_health_check: "2026-10-11T07:00:00Z",
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverview,
    } as any);

    const res = await adminApi.getOverview();
    expect(res.total_users).toBe(120);
    expect(res.system_status).toBe("operational");
  });

  it("lists users with search parameter", async () => {
    const mockUsers = [
      {
        id: "usr-1",
        email: "admin@tradex.ai",
        full_name: "Admin User",
        role: "admin",
        is_active: true,
        email_verified: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    } as any);

    const res = await adminApi.listUsers({ search: "admin" });
    expect(res).toHaveLength(1);
    expect(res[0].role).toBe("admin");
  });

  it("returns audit logs export url", () => {
    const url = adminApi.getAuditLogsExportUrl();
    expect(url).toBe("/api/v1/admin/audit-logs/export");
  });
});
