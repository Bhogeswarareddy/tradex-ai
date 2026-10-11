import { api, ApiClient, ApiError } from "./client";

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

  async verifyEmail(token: string): Promise<{ message: string }> {
    return this.client.post<{ message: string }>("/auth/verify-email", { token });
  }
}

export const authApi = new AuthService();
