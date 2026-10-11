
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("tradex_access_token") || ""}`,
});

export interface Shipment {
  id: string;
  shipment_number: string;
  carrier: string;
  tracking_number: string;
  origin: string;
  destination: string;
  status: string;
  mode?: string;
  vessel_or_flight?: string;
  container_number?: string;
  freight_forwarder?: string;
  incoterm?: string;
  goods?: string;
  eta?: string;
  current_latitude?: number;
  current_longitude?: number;
  current_location?: string;
  estimated_delivery?: string;
  order_number?: string;
}

export interface ShipmentEvent {
  id: string;
  event_type: string;
  status: string;
  location: string;
  description: string;
  occurred_at: string;
}

export const shipmentsApi = {
  list: async (params?: Record<string, any>) => {
    const q = new URLSearchParams(params as any).toString();
    const r = await fetch(`/api/v1/shipments${q ? `?${q}` : ""}`, { headers: authHeaders() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  get: async (id: string): Promise<Shipment> => {
    const r = await fetch(`/api/v1/shipments/${id}`, { headers: authHeaders() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  events: async (id: string): Promise<ShipmentEvent[] | { events: ShipmentEvent[] }> => {
    const r = await fetch(`/api/v1/shipments/${id}/events`, { headers: authHeaders() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  aiSummary: async (id: string) => {
    const r = await fetch(`/api/v1/ai/shipments/${id}/summary`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  simulateStep: async (id: string) => {
    const r = await fetch(`/api/v1/shipments/${id}/simulate-step`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};
