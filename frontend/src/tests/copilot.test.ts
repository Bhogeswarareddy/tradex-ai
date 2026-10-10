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

describe("copilotApi", () => {
  it("sendMessage sends query and receives grounded response with citations", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: "**HS Code for Turmeric Powder**: `0910.30.20`",
        suggested_actions: ["Compare EU Landed Cost", "Draft Turmeric RFQ"],
        sources: [
          {
            title: "HS Code Classification & Tariffs",
            guide_slug: "hs_code_classification",
            source_uri: "/guides/hs_code_classification",
          },
        ],
        conversation_id: "conv-123",
      }),
    });

    const { copilotApi } = await import("../lib/api/copilot");
    const result = await copilotApi.sendMessage("Check HS code for turmeric powder");

    expect(result.response).toContain("0910.30.20");
    expect(result.sources?.length).toBe(1);
    expect(result.suggested_actions.length).toBe(2);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai/copilot/chat",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Check HS code for turmeric powder"),
      })
    );
  });

  it("getSuggestedPrompts returns trade prompt list", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: "p1", prompt: "Analyze this RFQ and suggest best suppliers", category: "rfq" },
        { id: "p2", prompt: "Compare landed cost for India to Germany", category: "logistics" },
      ],
    });

    const { copilotApi } = await import("../lib/api/copilot");
    const prompts = await copilotApi.getSuggestedPrompts();
    expect(prompts.length).toBe(2);
    expect(prompts[0].prompt).toContain("Analyze this RFQ");
  });

  it("getGuides returns trade compliance guides catalog", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { slug: "incoterms_2020", title: "Incoterms® 2020 Rules", category: "Logistics", topics: ["FOB", "CIF"] },
        { slug: "eu_organic_regulations", title: "EU Organic Regulations", category: "Compliance", topics: ["TRACES"] },
      ],
    });

    const { copilotApi } = await import("../lib/api/copilot");
    const guides = await copilotApi.getGuides();
    expect(guides.length).toBe(2);
    expect(guides[0].slug).toBe("incoterms_2020");
  });

  it("listConversations returns user chat history", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: "c1", title: "Turmeric Inquiry", created_at: "2026-10-10", updated_at: "2026-10-10" },
      ],
    });

    const { copilotApi } = await import("../lib/api/copilot");
    const history = await copilotApi.listConversations();
    expect(history.length).toBe(1);
    expect(history[0].id).toBe("c1");
  });
});
