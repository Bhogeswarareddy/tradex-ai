export type UserRole = "buyer" | "supplier" | "admin";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
  company_id?: string;
  company_name?: string;
  company_country?: string;
  created_at?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  role: "buyer" | "supplier";
  company_name: string;
  country: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface UpdateProfileRequest {
  full_name?: string;
  company_name?: string;
  country?: string;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

class AuthService {
  private accessToken: string | null = null;

  constructor() {
    if (typeof localStorage !== "undefined") {
      this.accessToken = localStorage.getItem("tradex_access_token");
    }
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (typeof localStorage !== "undefined") {
      if (token) {
        localStorage.setItem("tradex_access_token", token);
      } else {
        localStorage.removeItem("tradex_access_token");
      }
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOnUnauthorized = true
  ): Promise<T> {
    const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Essential for httpOnly refresh token cookie
    });

    if (response.status === 401 && retryOnUnauthorized && !endpoint.includes("/auth/")) {
      // Try silent refresh
      try {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          headers["Authorization"] = `Bearer ${refreshed.access_token}`;
          const retryResponse = await fetch(url, {
            ...options,
            headers,
            credentials: "include",
          });
          if (!retryResponse.ok) {
            const errData = await retryResponse.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `HTTP ${retryResponse.status}`);
          }
          return retryResponse.json() as Promise<T>;
        }
      } catch {
        this.setAccessToken(null);
        throw new Error("Session expired. Please log in again.");
      }
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const message = errData?.error?.message || errData?.detail || `HTTP ${response.status}`;
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    this.setAccessToken(res.access_token);
    return res;
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    this.setAccessToken(res.access_token);
    return res;
  }

  async refreshToken(): Promise<AuthResponse | null> {
    try {
      const res = await this.request<AuthResponse>(
        "/auth/refresh",
        {
          method: "POST",
        },
        false
      );
      this.setAccessToken(res.access_token);
      return res;
    } catch {
      this.setAccessToken(null);
      return null;
    }
  }

  async logout(): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>("/auth/logout", {
        method: "POST",
      }, false);
    } finally {
      this.setAccessToken(null);
    }
  }

  async getMe(): Promise<User> {
    return this.request<User>("/users/me");
  }

  async updateMe(data: UpdateProfileRequest): Promise<User> {
    return this.request<User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
    return this.request<{ message: string }>("/users/me/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }
}

export const authApi = new AuthService();
