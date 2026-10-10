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

describe("documentsApi", () => {
  it("list calls GET /api/v1/documents with filters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0, page: 1, page_size: 20, total_pages: 1 }),
    });
    const { documentsApi } = await import("../lib/api/documents");
    const result = await documentsApi.list({ doc_type: "certificate", status: "verified" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/documents?doc_type=certificate&status=verified"),
      expect.any(Object)
    );
    expect(result.items).toEqual([]);
  });

  it("extract sends POST to /api/v1/documents/:id/extract", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "extracted",
        document_id: "doc-123",
        extraction_id: "ext-456",
        data: { company_name: "Sri Bharat Spices Pvt Ltd" },
        confidence_score: 0.95,
      }),
    });
    const { documentsApi } = await import("../lib/api/documents");
    const result = await documentsApi.extract("doc-123");
    expect(result.status).toBe("extracted");
    expect(result.confidence_score).toBe(0.95);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/documents/doc-123/extract",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("confirm sends POST to /api/v1/documents/:id/confirm with payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "confirmed",
        document_id: "doc-123",
        document_status: "verified",
        applied_actions: ["Created verified SupplierCertification: EU Organic"],
      }),
    });
    const { documentsApi } = await import("../lib/api/documents");
    const result = await documentsApi.confirm("doc-123", {
      apply_to_supplier: true,
      apply_to_order: false,
    });
    expect(result.status).toBe("confirmed");
    expect(result.applied_actions.length).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/documents/doc-123/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ apply_to_supplier: true, apply_to_order: false }),
      })
    );
  });

  it("delete sends DELETE to /api/v1/documents/:id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "deleted" }),
    });
    const { documentsApi } = await import("../lib/api/documents");
    const result = await documentsApi.delete("doc-123");
    expect(result.status).toBe("deleted");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/documents/doc-123",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
