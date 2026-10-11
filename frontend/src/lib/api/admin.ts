const getStorageItem = (key: string): string => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage.getItem(key) || "";
  }
  if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage.getItem(key) || "";
  }
  return "";
};

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getStorageItem("tradex_access_token")}`,
});

export interface AdminOverview {
  total_users: number;
  total_orders: number;
  cumulative_trade_value_eur: number;
  pending_supplier_verifications: number;
  system_status: string;
  last_health_check: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: string | null;
}

export interface VerificationQueueItem {
  company_id: string;
  company_name: string;
  country: string;
  city: string;
  years_in_business: number;
  verified_status: string;
  supplier_id: string | null;
  contact_email: string | null;
  documents: Array<{
    id: string;
    title: string;
    doc_type: string;
    status: string;
    file_path: string;
  }>;
}

export interface AuditLogItem {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string | null;
}

export interface SystemSettingItem {
  key: string;
  value: Record<string, any>;
  description?: string | null;
}

export const adminApi = {
  getOverview: async (): Promise<AdminOverview> => {
    const r = await fetch("/api/v1/admin/overview", { headers: authHeaders() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  listUsers: async (params?: { role?: string; is_active?: boolean; search?: string }): Promise<AdminUser[]> => {
    const q = new URLSearchParams(params as any).toString();
    const r = await fetch(`/api/v1/admin/users${q ? `?${q}` : ""}`, { headers: authHeaders() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  updateUser: async (userId: string, data: { is_active?: boolean; role?: string }): Promise<any> => {
    const r = await fetch(`/api/v1/admin/users/${userId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  getVerificationQueue: async (): Promise<VerificationQueueItem[]> => {
    const r = await fetch("/api/v1/admin/verification-queue", { headers: authHeaders() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  decideVerification: async (companyId: string, action: "approve" | "reject", notes?: string): Promise<any> => {
    const r = await fetch(`/api/v1/admin/verification/${companyId}/decision`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action, notes }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  listAuditLogs: async (params?: { action?: string; entity_type?: string }): Promise<AuditLogItem[]> => {
    const q = new URLSearchParams(params as any).toString();
    const r = await fetch(`/api/v1/admin/audit-logs${q ? `?${q}` : ""}`, { headers: authHeaders() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  getAuditLogsExportUrl: () => "/api/v1/admin/audit-logs/export",

  getSettings: async (): Promise<SystemSettingItem[]> => {
    const r = await fetch("/api/v1/admin/settings", { headers: authHeaders() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  saveSetting: async (key: string, value: Record<string, any>, description?: string): Promise<any> => {
    const r = await fetch("/api/v1/admin/settings", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ key, value, description }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};
