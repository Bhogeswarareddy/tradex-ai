import { HealthStatus } from "./types";

export interface ApiErrorPayload {
  code?: string;
  message: string;
  status: number;
  details?: unknown;
}

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: unknown;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.status = payload.status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '/api/v1';

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
    if (typeof localStorage !== 'undefined') {
      this.token = localStorage.getItem('tradex_access_token');
    }
  }

  public getAccessToken(): string | null {
    if (this.token) return this.token;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('tradex_access_token');
    }
    return null;
  }

  public setAccessToken(token: string | null): void {
    this.token = token;
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem('tradex_access_token', token);
      } else {
        localStorage.removeItem('tradex_access_token');
      }
    }
  }

  public handleAuthFailure(): void {
    this.setAccessToken(null);
    if (typeof window !== 'undefined' && window.location) {
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
  }

  public async refreshToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const url = `${this.baseUrl}/auth/refresh`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!res.ok) {
          this.handleAuthFailure();
          return null;
        }

        const data = await res.json();
        const newToken = data.access_token || data.token || null;
        if (newToken) {
          this.setAccessToken(newToken);
          return newToken;
        } else {
          this.handleAuthFailure();
          return null;
        }
      } catch {
        this.handleAuthFailure();
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async normalizeError(response: Response): Promise<ApiError> {
    let message = "Request failed with status " + response.status;
    let code: string | undefined = undefined;
    let details: unknown = undefined;

    try {
      const data = await response.json();
      if (data) {
        if (typeof data.detail === 'string') {
          message = data.detail;
        } else if (Array.isArray(data.detail)) {
          message = data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
          details = data.detail;
        } else if (data.error && typeof data.error === 'object') {
          message = data.error.message || message;
          code = data.error.code;
          details = data.error.details;
        } else if (data.message) {
          message = data.message;
        }
      }
    } catch {
      try {
        const text = await response.text();
        if (text) message = text;
      } catch {
        // fallback
      }
    }

    return new ApiError({
      status: response.status,
      code,
      message,
      details,
    });
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOnUnauthorized = true
  ): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    const url = this.baseUrl + cleanEndpoint;

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const token = this.getAccessToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: options.credentials || 'include',
    });

    if (
      response.status === 401 &&
      retryOnUnauthorized &&
      !cleanEndpoint.includes('/auth/login') &&
      !cleanEndpoint.includes('/auth/refresh') &&
      !cleanEndpoint.includes('/auth/register')
    ) {
      const newToken = await this.refreshToken();
      if (newToken) {
        const retryHeaders: Record<string, string> = {
          ...headers,
          Authorization: 'Bearer ' + newToken,
        };
        const retryResponse = await fetch(url, {
          ...options,
          headers: retryHeaders,
          credentials: options.credentials || 'include',
        });

        if (!retryResponse.ok) {
          throw await this.normalizeError(retryResponse);
        }
        return retryResponse.json() as Promise<T>;
      } else {
        throw new ApiError({
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'Session expired. Please log in again.',
        });
      }
    }

    if (!response.ok) {
      throw await this.normalizeError(response);
    }

    // If 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    let path = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, String(val));
        }
      });
      const qs = searchParams.toString();
      if (qs) {
        path += (path.includes('?') ? '&' : '?') + qs;
      }
    }
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async checkHealth(): Promise<HealthStatus> {
    return this.get<HealthStatus>('/health');
  }
}

export const api = new ApiClient();
