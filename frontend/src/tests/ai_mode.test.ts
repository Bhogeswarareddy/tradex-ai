import { describe, it, expect, vi, beforeEach } from "vitest";
import { aiModeApi } from "../lib/api/aiMode";
import { api } from "../lib/api/client";

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
  api.setAccessToken("test-token");
});

describe("AI Mode API Client (Prompt 18, 19 & 21)", () => {
  it("listConversations calls GET /api/v1/ai-mode/conversations", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "conv-1",
          title: "Organic Turmeric Inquiry",
          search_state: {},
          created_at: "2026-10-14T10:00:00Z",
          updated_at: "2026-10-14T10:00:00Z",
          messages_count: 2,
          selected_count: 0,
        },
      ],
    });

    const res = await aiModeApi.listConversations();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai-mode/conversations",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe("Organic Turmeric Inquiry");
  });

  it("createConversation posts to /api/v1/ai-mode/conversations", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "conv-new",
        title: "New Sourcing Request",
        search_state: {},
        created_at: "2026-10-14T10:00:00Z",
        updated_at: "2026-10-14T10:00:00Z",
        messages_count: 0,
        selected_count: 0,
      }),
    });

    const res = await aiModeApi.createConversation("New Sourcing Request");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai-mode/conversations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "New Sourcing Request" }),
      })
    );
    expect(res.id).toBe("conv-new");
  });

  it("sendMessage sends buyer query and returns assistant reply with product cards", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user_message: {
          id: "msg-1",
          conversation_id: "conv-1",
          role: "user",
          content: "Find affordable laptops",
          provider: "openai",
          is_demo: false,
          created_at: "2026-10-14T10:00:00Z",
        },
        assistant_reply: {
          id: "msg-2",
          conversation_id: "conv-1",
          role: "assistant",
          content: "Found 2 matching suppliers",
          structured: {
            criteria: { product: "laptop", destination: "USA" },
            product_ids: ["prod-1", "prod-2"],
            classification: "new_search",
          },
          provider: "openai",
          is_demo: false,
          created_at: "2026-10-14T10:00:01Z",
        },
        classification: "new_search",
        product_cards: [
          {
            product_id: "prod-1",
            title: "ProBook Ultrathin 15.6",
            supplier_name: "Shenzhen Horizon Tech",
            origin_country: "China",
            unit_price: 435,
            currency: "USD",
            price_status: "current",
            moq: 50,
            supplier_verification: true,
            certifications: ["CE", "RoHS"],
            match_explanation: { matched: ["product", "low price"], unmatched: [] },
          },
        ],
      }),
    });

    const result = await aiModeApi.sendMessage("conv-1", "Find affordable laptops");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai-mode/conversations/conv-1/messages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "Find affordable laptops" }),
      })
    );
    expect(result.assistant_reply.content).toContain("Found 2 matching suppliers");
    expect(result.product_cards).toHaveLength(1);
    expect(result.product_cards[0].title).toBe("ProBook Ultrathin 15.6");
  });

  it("selectProduct and unselectProduct manage conversation product selection", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "selected", conversation_id: "conv-1", product_id: "prod-1" }),
    });

    const sel = await aiModeApi.selectProduct("conv-1", "prod-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai-mode/conversations/conv-1/selection/prod-1",
      expect.objectContaining({ method: "POST" })
    );
    expect(sel.status).toBe("selected");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "unselected", conversation_id: "conv-1", product_id: "prod-1" }),
    });

    const unsel = await aiModeApi.unselectProduct("conv-1", "prod-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai-mode/conversations/conv-1/selection/prod-1",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(unsel.status).toBe("unselected");
  });

  it("chatNow initiates or resumes buyer-supplier thread through communication service", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "created",
        thread_id: "thread-abc-123",
        title: "Product Inquiry: ProBook Ultrathin 15.6",
        product_id: "prod-1",
        supplier_id: "sup-1",
        buyer_id: "buyer-1",
      }),
    });

    const chat = await aiModeApi.chatNow("conv-1", "prod-1");
    expect(chat.thread_id).toBe("thread-abc-123");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai-mode/conversations/conv-1/products/prod-1/chat",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("createNegotiationDraft generates initial AI message and sendNegotiationDraft confirms sending", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "draft-1",
        conversation_id: "conv-1",
        product_id: "prod-1",
        original_unit_price: 450,
        target_price: 410,
        currency: "USD",
        quantity: 100,
        ai_suggested_message: "Dear Shenzhen Tech, based on our order volume of 100 units...",
        status: "draft",
      }),
    });

    const draft = await aiModeApi.createNegotiationDraft("conv-1", "prod-1", {
      target_price: 410,
      quantity: 100,
    });
    expect(draft.ai_suggested_message).toContain("Dear Shenzhen Tech");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "draft-1",
        status: "sent",
        linked_thread_id: "thread-xyz",
      }),
    });

    const sent = await aiModeApi.sendNegotiationDraft("draft-1", {
      confirm: true,
      final_message: "Customized offer text",
    });
    expect(sent.status).toBe("sent");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai-mode/negotiation-drafts/draft-1/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          confirm: true,
          final_message: "Customized offer text",
        }),
      })
    );
  });

  it("handles 401 token expiry by transparently refreshing token and completing AI Mode request", async () => {
    // 1st call fails with 401 Unauthorized
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: async () => ({ detail: "Token expired" }),
    });

    // 2nd call to /auth/refresh succeeds and returns new token
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ access_token: "refreshed-jwt-token-999" }),
    });

    // 3rd call (retry) succeeds with updated token
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => [
        {
          id: "conv-refreshed",
          title: "Session Maintained Sourcing",
          search_state: {},
          created_at: "2026-10-28T10:00:00Z",
          updated_at: "2026-10-28T10:00:00Z",
          messages_count: 1,
          selected_count: 0,
        },
      ],
    });

    const res = await aiModeApi.listConversations();
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("conv-refreshed");

    // Verify /auth/refresh was called
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/auth/refresh",
      expect.objectContaining({ method: "POST" })
    );

    // Verify replayed request used the new refreshed token
    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/v1/ai-mode/conversations",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer refreshed-jwt-token-999",
        }),
      })
    );
  });

  it("fetches AI provider status via getAiStatus", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        provider: "groq",
        model: "llama-3.1-8b-instant",
        reachable: true,
        last_latency: 142.5,
        mode: "live",
        configured_providers: ["groq"],
        priority: ["groq", "openrouter", "ollama"],
      }),
    });

    const status = await aiModeApi.getAiStatus();
    expect(status.provider).toBe("groq");
    expect(status.mode).toBe("live");
    expect(status.reachable).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai/status",
      expect.objectContaining({ method: "GET" })
    );
  });
});
