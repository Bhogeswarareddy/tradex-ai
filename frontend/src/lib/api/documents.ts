const API = "/api/v1";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("tradex_access_token") || ""}`,
});

export interface DocumentItem {
  id: string;
  title: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  doc_type: string;
  status: "uploaded" | "processing" | "extracted" | "needs_review" | "verified" | "rejected";
  order_id?: string | null;
  rfq_id?: string | null;
  supplier_id?: string | null;
  expiry_date?: string | null;
  is_expired?: boolean;
  has_extractions?: boolean;
  confidence_score?: number | null;
  created_at: string;
}

export interface DocumentExtractionDetail {
  id: string;
  confidence_score: number;
  status: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  extracted_json: {
    company_name?: string;
    product?: string;
    certification_type?: string;
    certificate_number?: string;
    issue_date?: string;
    expiry_date?: string;
    quantity?: number;
    unit?: string;
    hs_codes?: string[];
    capacity?: string;
    invoice_amount?: number;
    currency?: string;
    field_confidences?: Record<string, number>;
    confidence_score?: number;
    status?: string;
    [key: string]: any;
  };
}

export interface DocumentDetail extends DocumentItem {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  extractions: DocumentExtractionDetail[];
}

export interface DocumentListResponse {
  items: DocumentItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const documentsApi = {
  async list(params: {
    doc_type?: string;
    status?: string;
    search?: string;
    page?: number;
    page_size?: number;
    order_id?: string;
    rfq_id?: string;
    supplier_id?: string;
  } = {}): Promise<DocumentListResponse> {
    const q = new URLSearchParams();
    if (params.doc_type && params.doc_type !== "all") q.set("doc_type", params.doc_type);
    if (params.status && params.status !== "all") q.set("status", params.status);
    if (params.search) q.set("search", params.search);
    if (params.page) q.set("page", String(params.page));
    if (params.page_size) q.set("page_size", String(params.page_size));
    if (params.order_id) q.set("order_id", params.order_id);
    if (params.rfq_id) q.set("rfq_id", params.rfq_id);
    if (params.supplier_id) q.set("supplier_id", params.supplier_id);

    const res = await fetch(`${API}/documents?${q.toString()}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch documents");
    return res.json();
  },

  async get(id: string): Promise<DocumentDetail> {
    const res = await fetch(`${API}/documents/${id}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch document detail");
    return res.json();
  },

  async upload(
    file: File,
    meta: {
      doc_type?: string;
      title?: string;
      order_id?: string;
      rfq_id?: string;
      supplier_id?: string;
      expiry_date?: string;
    } = {}
  ): Promise<{ status: string; document_id: string; title: string }> {
    const formData = new FormData();
    formData.append("file", file);
    if (meta.doc_type) formData.append("doc_type", meta.doc_type);
    if (meta.title) formData.append("title", meta.title);
    if (meta.order_id) formData.append("order_id", meta.order_id);
    if (meta.rfq_id) formData.append("rfq_id", meta.rfq_id);
    if (meta.supplier_id) formData.append("supplier_id", meta.supplier_id);
    if (meta.expiry_date) formData.append("expiry_date", meta.expiry_date);

    const res = await fetch(`${API}/documents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("tradex_access_token") || ""}`,
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  async extract(id: string): Promise<{
    status: string;
    document_id: string;
    extraction_id: string;
    data: any;
    confidence_score: number;
  }> {
    const res = await fetch(`${API}/documents/${id}/extract`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Extraction failed" }));
      throw new Error(err.detail || "Extraction failed");
    }
    return res.json();
  },

  async confirm(
    id: string,
    payload: {
      apply_to_supplier?: boolean;
      apply_to_order?: boolean;
      override_data?: Record<string, any>;
    } = { apply_to_supplier: true, apply_to_order: true }
  ): Promise<{
    status: string;
    document_id: string;
    document_status: string;
    applied_actions: string[];
  }> {
    const res = await fetch(`${API}/documents/${id}/confirm`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Confirmation failed" }));
      throw new Error(err.detail || "Confirmation failed");
    }
    return res.json();
  },

  async reject(
    id: string,
    payload: { reason?: string } = { reason: "Document rejected during compliance review" }
  ): Promise<{ status: string; document_id: string; document_status: string }> {
    const res = await fetch(`${API}/documents/${id}/reject`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Rejection failed" }));
      throw new Error(err.detail || "Rejection failed");
    }
    return res.json();
  },

  async delete(id: string): Promise<{ status: string }> {
    const res = await fetch(`${API}/documents/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Delete failed" }));
      throw new Error(err.detail || "Delete failed");
    }
    return res.json();
  },

  async download(id: string, filename: string): Promise<void> {
    const res = await fetch(`${API}/documents/${id}/download`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to download document or permission denied");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
