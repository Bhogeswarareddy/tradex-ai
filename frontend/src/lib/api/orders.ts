const API = "/api/v1";

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("tradex_access_token") || ""}`,
});

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_type: string;
  payment_method: string;
  simulated: boolean;
  transaction_ref: string;
  notes: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  currency: string;
  paid_amount?: number;
  payment_terms?: string;
  incoterm?: string;
  buyer_name?: string;
  supplier_name?: string;
  supplier_logo?: string;
  shipment_number?: string;
  shipment_id?: string;
  items_count?: number;
  created_at: string;
}

export interface OrderDetail extends Order {
  rfq_id?: string;
  rfq_title?: string;
  quotation_id?: string;
  quote_number?: string;
  shipping_address?: string;
  buyer: { id: string; name: string; country: string; city: string };
  supplier: { id: string; name: string; country: string; city: string; logo?: string };
  items: OrderItem[];
  payments: Payment[];
  shipment?: {
    id: string;
    shipment_number: string;
    carrier: string;
    tracking_number: string;
    origin: string;
    destination: string;
    status: string;
    estimated_delivery?: string;
  };
  payment_summary: {
    total_due: number;
    total_paid: number;
    escrow_locked: number;
    balance_due: number;
    simulated: boolean;
  };
  documents: any[];
  audit_trail: any[];
}

export interface TradeFinanceOverview {
  banner: string;
  simulated: boolean;
  credit_facility: {
    credit_limit: number;
    utilized_credit: number;
    available_credit: number;
    currency: string;
    facility_status: string;
  };
  balances: {
    escrow_locked: number;
    released_to_suppliers: number;
    total_settled: number;
    currency: string;
  };
  transactions: any[];
}

export const ordersApi = {
  list: async (params?: Record<string, any>) => {
    const q = new URLSearchParams(params as any).toString();
    const r = await fetch(`${API}/orders${q ? `?${q}` : ""}`, { headers: authHeaders() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  get: async (id: string): Promise<OrderDetail> => {
    const r = await fetch(`${API}/orders/${id}`, { headers: authHeaders() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  transition: async (id: string, body: { status: string; notes?: string }) => {
    const r = await fetch(`${API}/orders/${id}/transition`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  cancel: async (id: string, reason?: string) => {
    const r = await fetch(`${API}/orders/${id}/cancel`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  simulatePayment: async (id: string, body: { payment_type: string; amount?: number; notes?: string }) => {
    const r = await fetch(`${API}/orders/${id}/payments/simulate`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  tradeFinanceOverview: async (): Promise<TradeFinanceOverview> => {
    const r = await fetch(`${API}/trade-finance/overview`, { headers: authHeaders() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  applyTradeFinance: async (body: {
    facility_type: string;
    requested_amount: number;
    tenor_days: number;
    counterparty_name: string;
  }) => {
    const r = await fetch(`${API}/trade-finance/apply`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};
