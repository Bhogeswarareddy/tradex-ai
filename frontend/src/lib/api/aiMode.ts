/**
 * TradeX AI - AI Mode Frontend API Client (Prompt 18 & 19)
 */

const API_BASE = "/api/v1/ai-mode";

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem("tradex_access_token") || localStorage.getItem("token") || "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface ProductCardData {
  product_id: string;
  image?: string | null;
  title: string;
  supplier_name: string;
  origin_country: string;
  unit_price: number;
  price_range?: string | null;
  currency: string;
  price_status: string; // current, unconfirmed, stale
  moq: number;
  supplier_verification: boolean;
  certifications: string[];
  lead_time?: number | null;
  match_explanation?: {
    matched?: string[];
    unmatched?: string[];
  };
  demo_data?: boolean;
}

export interface AIMessageData {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  structured?: {
    criteria?: Record<string, any>;
    product_ids?: string[];
    classification?: string;
    clarifying_question?: string | null;
    comparison_data?: any;
    demo_ai?: boolean;
    product_cards?: ProductCardData[];
    follow_ups?: string[];
    sources?: any[];
  } | null;
  provider: string;
  is_demo: boolean;
  created_at: string;
}

export interface ConversationItem {
  id: string;
  title: string;
  search_state: Record<string, any>;
  created_at: string;
  updated_at: string;
  messages_count: number;
  selected_count: number;
}

export interface ConversationDetailData {
  id: string;
  title: string;
  search_state: Record<string, any>;
  created_at: string;
  updated_at: string;
  messages: AIMessageData[];
  selected_products: ProductCardData[];
}

export interface MessageTurnResult {
  user_message: AIMessageData;
  assistant_reply: AIMessageData;
  classification: string;
  product_cards: ProductCardData[];
  clarifying_question?: string | null;
  comparison_data?: any;
}

export interface NegotiationDraftData {
  id: string;
  conversation_id: string;
  product_id: string;
  supplier_id: string;
  buyer_id: string;
  original_unit_price: number;
  currency: string;
  original_moq: number;
  target_price: number;
  quantity: number;
  ai_suggested_message: string;
  final_message?: string | null;
  status: "draft" | "sent" | "cancelled";
  linked_thread_id?: string | null;
  created_at: string;
}

export const aiModeApi = {
  createConversation: async (title?: string): Promise<ConversationItem> => {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(title ? { title } : {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || "Failed to create conversation");
    }
    return res.json();
  },

  listConversations: async (): Promise<ConversationItem[]> => {
    const res = await fetch(`${API_BASE}/conversations`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || "Failed to list conversations");
    }
    return res.json();
  },

  getConversation: async (id: string): Promise<ConversationDetailData> => {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || "Conversation not found");
    }
    return res.json();
  },

  renameConversation: async (id: string, title: string): Promise<ConversationItem> => {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || "Failed to rename conversation");
    }
    return res.json();
  },

  deleteConversation: async (id: string): Promise<{ status: string; id: string }> => {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || "Failed to delete conversation");
    }
    return res.json();
  },

  sendMessage: async (id: string, content: string): Promise<MessageTurnResult> => {
    const res = await fetch(`${API_BASE}/conversations/${id}/messages`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || "Failed to send message");
    }
    return res.json();
  },

  selectProduct: async (id: string, productId: string): Promise<{ status: string }> => {
    const res = await fetch(`${API_BASE}/conversations/${id}/selection/${productId}`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || "Failed to select product");
    }
    return res.json();
  },

  unselectProduct: async (id: string, productId: string): Promise<{ status: string }> => {
    const res = await fetch(`${API_BASE}/conversations/${id}/selection/${productId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || "Failed to unselect product");
    }
    return res.json();
  },

  compareProducts: async (id: string): Promise<{
    conversation_id: string;
    products_count: number;
    comparison_table: any[];
    recommendation?: string;
  }> => {
    const res = await fetch(`${API_BASE}/conversations/${id}/compare`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || "Failed to compare products");
    }
    return res.json();
  },

  chatNow: async (id: string, productId: string): Promise<{
    status: string;
    thread_id: string;
    title: string;
    product_id: string;
    supplier_id: string;
    buyer_id: string;
  }> => {
    const res = await fetch(`${API_BASE}/conversations/${id}/products/${productId}/chat`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || "Failed to initiate chat");
    }
    return res.json();
  },

  createNegotiationDraft: async (
    id: string,
    productId: string,
    payload: { target_price: number; quantity: number; notes?: string }
  ): Promise<NegotiationDraftData> => {
    const res = await fetch(`${API_BASE}/conversations/${id}/products/${productId}/negotiation-draft`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || "Failed to generate negotiation draft");
    }
    return res.json();
  },

  sendNegotiationDraft: async (
    draftId: string,
    payload: { confirm: boolean; final_message: string }
  ): Promise<NegotiationDraftData> => {
    const res = await fetch(`${API_BASE}/negotiation-drafts/${draftId}/send`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || "Failed to send negotiation message");
    }
    return res.json();
  },
};
