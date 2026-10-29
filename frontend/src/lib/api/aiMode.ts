/**
 * TradeX AI - AI Mode Frontend API Client (Prompt 18, 19 & 21)
 * Routes all requests through the shared ApiClient (`api`) for automatic
 * token injection, 401 interception, and seamless session refresh.
 */
import { api } from "./client";

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
  availability_status?: string;
  available_quantity?: number | null;
  is_alternative?: boolean;
  price_original?: number;
  currency_original?: string;
  price_display?: number;
  currency_display?: string;
  rate?: number;
  rate_as_of?: string;
  is_simulated?: boolean;
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
    active_filters?: Array<{ label: string; value: string }>;
    suggested_chips?: string[];
  } | null;
  provider: string;
  model?: string | null;
  is_demo: boolean;
  latency_ms?: number | null;
  fallback_reason?: string | null;
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
  has_more?: boolean;
  total_cards?: number;
  active_filters?: Array<{ label: string; value: string }>;
  suggested_chips?: string[];
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

export interface AiStatusResponse {
  provider: string;
  model: string;
  reachable: boolean;
  last_latency: number;
  mode: "live" | "demo";
  status_badge?: "Connected" | "Disconnected" | "Rate limited" | "Demo AI" | string;
  fallback_reason?: string | null;
  configured_providers: string[];
  priority: string[];
  circuit_breaker?: Record<string, any>;
}

export interface AiTestResponse {
  provider: string;
  model: string;
  latency_ms: number;
  reply: string;
  status: "success" | "error";
  error?: string;
}

export const aiModeApi = {
  createConversation: async (title?: string): Promise<ConversationItem> => {
    return api.post<ConversationItem>("/ai-mode/conversations", title ? { title } : {});
  },

  listConversations: async (): Promise<ConversationItem[]> => {
    return api.get<ConversationItem[]>("/ai-mode/conversations");
  },

  getConversation: async (id: string): Promise<ConversationDetailData> => {
    return api.get<ConversationDetailData>(`/ai-mode/conversations/${id}`);
  },

  renameConversation: async (id: string, title: string): Promise<ConversationItem> => {
    return api.patch<ConversationItem>(`/ai-mode/conversations/${id}`, { title });
  },

  deleteConversation: async (id: string): Promise<{ status: string; id: string }> => {
    return api.delete<{ status: string; id: string }>(`/ai-mode/conversations/${id}`);
  },

  sendMessage: async (id: string, content: string): Promise<MessageTurnResult> => {
    return api.post<MessageTurnResult>(`/ai-mode/conversations/${id}/messages`, { content });
  },

  selectProduct: async (id: string, productId: string): Promise<{ status: string }> => {
    return api.post<{ status: string }>(`/ai-mode/conversations/${id}/selection/${productId}`);
  },

  unselectProduct: async (id: string, productId: string): Promise<{ status: string }> => {
    return api.delete<{ status: string }>(`/ai-mode/conversations/${id}/selection/${productId}`);
  },

  compareProducts: async (id: string): Promise<{
    conversation_id: string;
    products_count: number;
    comparison_table: any[];
    recommendation?: string;
  }> => {
    return api.get<{
      conversation_id: string;
      products_count: number;
      comparison_table: any[];
      recommendation?: string;
    }>(`/ai-mode/conversations/${id}/compare`);
  },

  chatNow: async (id: string, productId: string): Promise<{
    status: string;
    thread_id: string;
    title: string;
    product_id: string;
    supplier_id: string;
    buyer_id: string;
  }> => {
    return api.post<{
      status: string;
      thread_id: string;
      title: string;
      product_id: string;
      supplier_id: string;
      buyer_id: string;
    }>(`/ai-mode/conversations/${id}/products/${productId}/chat`);
  },

  createNegotiationDraft: async (
    id: string,
    productId: string,
    payload: { target_price: number; quantity: number; notes?: string }
  ): Promise<NegotiationDraftData> => {
    return api.post<NegotiationDraftData>(
      `/ai-mode/conversations/${id}/products/${productId}/negotiation-draft`,
      payload
    );
  },

  sendNegotiationDraft: async (
    draftId: string,
    payload: { confirm: boolean; final_message: string }
  ): Promise<NegotiationDraftData> => {
    return api.post<NegotiationDraftData>(`/ai-mode/negotiation-drafts/${draftId}/send`, payload);
  },

  getAiStatus: async (): Promise<AiStatusResponse> => {
    return api.get<AiStatusResponse>("/ai/status");
  },

  testAiConnection: async (prompt?: string): Promise<AiTestResponse> => {
    return api.post<AiTestResponse>("/ai/test", { prompt });
  },
};
