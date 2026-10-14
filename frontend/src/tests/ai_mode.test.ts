import { describe, it, expect, vi, beforeEach } from "vitest";
import { aiModeApi } from "../lib/api/aiMode";

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

describe("AI Mode API Client (Prompt 18 & Prompt 19)", () => {
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
          provider: "gemini",
          is_demo: false,
          structured: {
            follow_ups: ["Filter by USA delivery", "Compare specs"],
          },
          created_at: "2026-10-14T10:00:01Z",
        },
        classification: "new_search",
        product_cards: [
          {
            product_id: "prod-1",
            title: "Enterprise Laptop 15",
            supplier_id: "sup-1",
            supplier_name: "Shenzhen Tech",
            origin_country: "China",
            unit_price: 450,
            currency: "USD",
            price_status: "CURRENT",
            moq: 50,
            supplier_verification: true,
            certifications: ["CE", "RoHS"],
            lead_time_days: 14,
          },
        ],
      }),
    });

    const res = await aiModeApi.sendMessage("conv-1", "Find affordable laptops");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai-mode/conversations/conv-1/messages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "Find affordable laptops" }),
      })
    );
    expect(res.product_cards).toHaveLength(1);
    expect(res.product_cards[0].price_status).toBe("CURRENT");
    expect(res.assistant_reply.structured?.follow_ups).toContain("Filter by USA delivery");
  });

  it("toggleSelectProduct posts and deletes selection", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        selected_product_ids: ["prod-1"],
      }),
    });

    const res = await aiModeApi.selectProduct("conv-1", "prod-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai-mode/conversations/conv-1/selection/prod-1",
      expect.objectContaining({ method: "POST" })
    );
    expect((res as any).selected_product_ids).toContain("prod-1");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        selected_product_ids: [],
      }),
    });
    const resRemove = await aiModeApi.unselectProduct("conv-1", "prod-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai-mode/conversations/conv-1/selection/prod-1",
      expect.objectContaining({ method: "DELETE" })
    );
    expect((resRemove as any).selected_product_ids).toHaveLength(0);
  });

  it("createOrReuseChat calls product chat endpoint idempotently", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        thread_id: "thread-xyz",
        product_id: "prod-1",
        supplier_id: "sup-1",
        supplier_name: "Shenzhen Tech",
        reused: false,
      }),
    });

    const res = await aiModeApi.chatNow("conv-1", "prod-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/ai-mode/conversations/conv-1/products/prod-1/chat",
      expect.objectContaining({ method: "POST" })
    );
    expect(res.thread_id).toBe("thread-xyz");
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
});
