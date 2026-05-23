export type UserRole = "free" | "pro" | "premium" | "admin";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  usage_today: number;
  daily_limit: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface MeResponse {
  authenticated: boolean;
  user?: User | null;
  usage_today: number;
  daily_limit: number;
  remaining: number;
  max_images?: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  usage_today: number;
  daily_limit: number;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  per_page: number;
}
