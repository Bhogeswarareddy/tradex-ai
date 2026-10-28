import { api, ApiClient } from "./client";

export type UserRole = "buyer" | "supplier" | "admin";

export interface UserSettings {
  notifications?: {
    messages?: boolean;
    rfq_updates?: boolean;
    new_quotes?: boolean;
    orders?: boolean;
    shipments?: boolean;
    document_verification?: boolean;
    email_notifications?: boolean;
  };
  currency?: string;
  language?: string;
  theme?: string;
}

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
  company_city?: string;
  company_website?: string;
  company_description?: string;
  company_years_in_business?: number;
  verified_status?: string;
  settings?: UserSettings;
  created_at?: string;
}

export interface CompanyAccount {
  id: string | null;
  name: string;
  country: string;
  city: string;
  state?: string | null;
  website?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  description?: string | null;
  years_in_business: number;
  verified_status: string;
  created_at?: string | null;
}

export interface SessionItem {
  id: string;
  created_at?: string;
  expires_at?: string;
  is_current: boolean;
  client_name: string;
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

class AuthService {
  private client: ApiClient;

  constructor(client: ApiClient = api) {
    this.client = client;
  }

  setAccessToken(token: string | null) {
    this.client.setAccessToken(token);
  }

  getAccessToken(): string | null {
    return this.client.getAccessToken();
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const res = await this.client.post<AuthResponse>("/auth/register", data);
    this.setAccessToken(res.access_token);
    return res;
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const res = await this.client.post<AuthResponse>("/auth/login", credentials);
    this.setAccessToken(res.access_token);
    return res;
  }

  async refreshToken(): Promise<AuthResponse | null> {
    const token = await this.client.refreshToken();
    if (token) {
      // Fetch fresh user profile
      try {
        const user = await this.getMe();
        return {
          access_token: token,
          token_type: "bearer",
          expires_in: 86400,
          user,
        };
      } catch {
        return null;
      }
    }
    return null;
  }

  async logout(): Promise<{ message: string }> {
    try {
      return await this.client.post<{ message: string }>("/auth/logout", {});
    } finally {
      this.setAccessToken(null);
    }
  }

  async getMe(): Promise<User> {
    return this.client.get<User>("/users/me");
  }

  async updateMe(data: UpdateProfileRequest): Promise<User> {
    return this.client.patch<User>("/users/me", data);
  }

  async changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
    return this.client.post<{ message: string }>("/users/me/change-password", data);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.client.post<{ message: string }>("/auth/forgot-password", { email });
  }

  async getCompany(): Promise<CompanyAccount> {
    return this.client.get<CompanyAccount>("/users/company");
  }

  async getSettings(): Promise<UserSettings> {
    return this.client.get<UserSettings>("/users/me/settings");
  }

  async getExchangeRates(): Promise<{ base: string; rates: Record<string, number>; notice: string }> {
    return this.client.get<{ base: string; rates: Record<string, number>; notice: string }>("/users/exchange-rates");
  }

  async updateSettings(data: UserSettings): Promise<UserSettings> {
    return this.client.patch<UserSettings>("/users/me/settings", data);
  }

  async listSessions(): Promise<SessionItem[]> {
    return this.client.get<SessionItem[]>("/users/me/sessions");
  }

  async revokeSession(sessionId: string): Promise<{ message: string }> {
    return this.client.delete<{ message: string }>(`/users/me/sessions/${sessionId}`);
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    return this.client.post<{ message: string }>("/auth/verify-email", { token });
  }
}

export const authApi = new AuthService();
