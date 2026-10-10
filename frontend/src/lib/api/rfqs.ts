const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("tradex_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface RFQDraftOutput {
  title: string;
  product: string;
  category: string;
  quantity: number;
  unit: string;
  specifications: Record<string, string>;
  quality_requirements: string;
  required_certifications: string[];
  destination_country: string;
  destination_port: string;
  incoterm: string;
  target_price_min: number;
  target_price_max: number;
  currency: string;
  payment_terms: string;
  delivery_days: number;
  suggested_supplier_criteria: string[];
}

export interface QuotationItem {
  id: string;
  quote_number: string;
  supplier_id: string;
  supplier_name: string;
  supplier_country: string;
  supplier_logo?: string;
  unit_price: number;
  landed_cost: number;
  freight_cost: number;
  currency: string;
  moq: number;
  lead_time_days: number;
  payment_terms: string;
  valid_until?: string;
  status: string;
  ai_score: number;
  ai_rank?: number;
  notes?: string;
  attachments?: string[];
}

export interface RFQDetail {
  id: string;
  rfq_number: string;
  title: string;
  product: string;
  category: string;
  status: string;
  quantity: number;
  unit: string;
  target_price_min: number;
  target_price_max: number;
  currency: string;
  destination_country: string;
  destination_port: string;
  deadline?: string;
  rfq_deadline?: string;
  delivery_deadline?: string;
  incoterm: string;
  payment_terms: string;
  specifications: Record<string, any>;
  quality_requirements: string;
  required_certifications: string[];
  attachments: string[];
  notes?: string;
  buyer_company_name?: string;
  quotes: QuotationItem[];
  quotes_count: number;
  created_at?: string;
}

export interface RFQListItem {
  id: string;
  rfq_number: string;
  title: string;
  product: string;
  category?: string;
  status: string;
  quantity: number;
  unit: string;
  target_price_min: number;
  target_price_max: number;
  currency: string;
  destination_country: string;
  destination_port: string;
  deadline?: string;
  incoterm: string;
  quotes_count: number;
  created_at?: string;
}

export const rfqsApi = {
  async generateDraft(buyerRequest: string): Promise<RFQDraftOutput> {
    const res = await fetch(`${BASE_URL}/rfqs/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ buyer_request: buyerRequest }),
    });
    if (!res.ok) throw new Error("Failed to generate RFQ draft");
    return res.json();
  },

  async create(data: Partial<RFQDetail>): Promise<{ id: string; rfq_number: string; status: string }> {
    const res = await fetch(`${BASE_URL}/rfqs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to create RFQ");
    }
    return res.json();
  },

  async list(params?: { status?: string; q?: string }): Promise<{ total: number; rfqs: RFQListItem[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.q) query.set("q", params.q);

    const res = await fetch(`${BASE_URL}/rfqs?${query.toString()}`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error("Failed to load RFQs");
    return res.json();
  },

  async getById(id: string): Promise<RFQDetail> {
    const res = await fetch(`${BASE_URL}/rfqs/${id}`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error("Failed to load RFQ detail");
    return res.json();
  },

  async publish(id: string): Promise<{ status: string; rfq_number: string }> {
    const res = await fetch(`${BASE_URL}/rfqs/${id}/publish`, {
      method: "POST",
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error("Failed to publish RFQ");
    return res.json();
  },

  async close(id: string): Promise<{ status: string; rfq_number: string }> {
    const res = await fetch(`${BASE_URL}/rfqs/${id}/close`, {
      method: "POST",
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error("Failed to close RFQ");
    return res.json();
  },

  async award(id: string, quoteId: string): Promise<{ status: string; winning_quote_number: string }> {
    const res = await fetch(`${BASE_URL}/rfqs/${id}/award`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ quote_id: quoteId }),
    });
    if (!res.ok) throw new Error("Failed to award RFQ");
    return res.json();
  },

  async invite(id: string, supplierIds: string[]): Promise<{ status: string; count: number }> {
    const res = await fetch(`${BASE_URL}/rfqs/${id}/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ supplier_ids: supplierIds }),
    });
    if (!res.ok) throw new Error("Failed to send invitations");
    return res.json();
  },

  async submitQuote(rfqId: string, quoteData: any): Promise<{ id: string; quote_number: string }> {
    const res = await fetch(`${BASE_URL}/rfqs/${rfqId}/quotes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(quoteData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to submit quote");
    }
    return res.json();
  },
};
