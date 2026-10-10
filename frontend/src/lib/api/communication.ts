const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("tradex_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ThreadListItem {
  id: string;
  title?: string;
  rfq_id?: string;
  quotation_id?: string;
  counterparty_name: string;
  counterparty_role: string;
  counterparty_country: string;
  counterparty_logo?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

export interface OfferData {
  price: number;
  quantity: number;
  unit: string;
  lead_time_days: number;
  currency: string;
  status: "pending" | "accepted" | "rejected" | "superseded";
  notes?: string;
}

export interface ThreadMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name?: string;
  is_me: boolean;
  body: string;
  message_type: "text" | "offer" | "system";
  offer_data?: OfferData;
  attachments?: string[];
  is_read: boolean;
  created_at: string;
}

export interface ThreadMessagesResponse {
  thread_id: string;
  title?: string;
  rfq_id?: string;
  quotation_id?: string;
  total_messages: number;
  messages: ThreadMessage[];
}

export interface CounterOfferInput {
  price: number;
  quantity?: number;
  lead_time_days?: number;
  note?: string;
}

export interface AINegotiationAssistOutput {
  recommended_counter_price: number;
  suggested_incoterm: string;
  compromise_terms: string;
  reasoning: string;
  draft_message_to_counterparty: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  event_type: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}

export interface NotificationsResponse {
  total_unread: number;
  notifications: NotificationItem[];
}

export const communicationApi = {
  async listThreads(): Promise<ThreadListItem[]> {
    const res = await fetch(`${BASE_URL}/threads`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to load message threads");
    }
    return res.json();
  },

  async getMessages(
    threadId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ThreadMessagesResponse> {
    const res = await fetch(`${BASE_URL}/threads/${threadId}/messages?limit=${limit}&offset=${offset}`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to load thread messages");
    }
    return res.json();
  },

  async sendMessage(
    threadId: string,
    body: string,
    messageType: string = "text",
    offerData?: any
  ): Promise<{ status: string; message_id: string; created_at: string }> {
    const res = await fetch(`${BASE_URL}/threads/${threadId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        body,
        message_type: messageType,
        offer_data: offerData,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to send message");
    }
    return res.json();
  },

  async markThreadRead(threadId: string): Promise<{ status: string; thread_id: string }> {
    const res = await fetch(`${BASE_URL}/threads/${threadId}/read`, {
      method: "POST",
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      throw new Error("Failed to mark thread as read");
    }
    return res.json();
  },

  async submitCounterOffer(
    quoteId: string,
    payload: CounterOfferInput
  ): Promise<{ status: string; thread_id: string; message_id: string; offer: OfferData }> {
    const res = await fetch(`${BASE_URL}/quotes/${quoteId}/counter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to submit counter-offer");
    }
    return res.json();
  },

  async acceptOffer(messageId: string): Promise<{ status: string; offer_price: number; lead_time_days: number }> {
    const res = await fetch(`${BASE_URL}/negotiations/${messageId}/accept`, {
      method: "POST",
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to accept offer");
    }
    return res.json();
  },

  async rejectOffer(messageId: string): Promise<{ status: string; message_id: string }> {
    const res = await fetch(`${BASE_URL}/negotiations/${messageId}/reject`, {
      method: "POST",
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to reject offer");
    }
    return res.json();
  },

  async getAiNegotiationAssist(params?: {
    thread_id?: string;
    target_price?: number;
    current_quote_price?: number;
  }): Promise<AINegotiationAssistOutput> {
    const query = new URLSearchParams();
    if (params?.thread_id) query.set("thread_id", params.thread_id);
    if (params?.target_price) query.set("target_price", String(params.target_price));
    if (params?.current_quote_price) query.set("current_quote_price", String(params.current_quote_price));

    const res = await fetch(`${BASE_URL}/ai/negotiation/assist?${query.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to get AI negotiation assist");
    }
    return res.json();
  },

  async getNotifications(limit: number = 30): Promise<NotificationsResponse> {
    const res = await fetch(`${BASE_URL}/notifications?limit=${limit}`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      throw new Error("Failed to fetch notifications");
    }
    return res.json();
  },

  async markAllNotificationsRead(): Promise<{ status: string }> {
    const res = await fetch(`${BASE_URL}/notifications/read-all`, {
      method: "POST",
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      throw new Error("Failed to mark all notifications read");
    }
    return res.json();
  },

  async markNotificationRead(id: string): Promise<{ status: string; id: string }> {
    const res = await fetch(`${BASE_URL}/notifications/${id}/read`, {
      method: "PATCH",
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      throw new Error("Failed to mark notification read");
    }
    return res.json();
  },
};
