const API = "/api/v1";

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("tradex_access_token") || ""}`,
});

export interface CopilotSource {
  title: string;
  guide_slug: string;
  source_uri: string;
  relevance_score?: number;
}

export interface CopilotChatResponse {
  response: string;
  suggested_actions: string[];
  sources?: CopilotSource[];
  conversation_id?: string;
}

export interface SuggestedPrompt {
  id: string;
  prompt: string;
  category?: string;
}

export interface TradeGuideSummary {
  slug: string;
  title: string;
  category: string;
  topics: string[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  created_at: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    sources?: CopilotSource[];
    suggested_actions?: Array<{ action: string }>;
    created_at: string;
  }>;
}

export const copilotApi = {
  async sendMessage(
    message: string,
    conversationId?: string,
    context?: Record<string, any>
  ): Promise<CopilotChatResponse> {
    const res = await fetch(`${API}/ai/copilot/chat`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        context,
      }),
    });
    if (!res.ok) throw new Error("Failed to send message to Copilot");
    return res.json();
  },

  async getSuggestedPrompts(): Promise<SuggestedPrompt[]> {
    const res = await fetch(`${API}/ai/copilot/suggested-prompts`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch suggested prompts");
    return res.json();
  },

  async getGuides(): Promise<TradeGuideSummary[]> {
    const res = await fetch(`${API}/ai/copilot/guides`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch knowledge guides");
    return res.json();
  },

  async listConversations(): Promise<ConversationSummary[]> {
    const res = await fetch(`${API}/ai/copilot/conversations`, {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  },

  async getConversation(id: string): Promise<ConversationDetail> {
    const res = await fetch(`${API}/ai/copilot/conversations/${id}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch conversation");
    return res.json();
  },

  async deleteConversation(id: string): Promise<{ status: string }> {
    const res = await fetch(`${API}/ai/copilot/conversations/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete conversation");
    return res.json();
  },
};
