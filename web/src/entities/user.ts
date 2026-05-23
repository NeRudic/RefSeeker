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

// ── Usage Dashboard ────────────────────────────────────────────────────

export interface DailyPoint {
  date: string;
  count: number;
}

export interface RoleCount {
  role: string;
  count: number;
}

export interface UsageSummary {
  total_requests: number;
  total_users: number;
  total_collections: number;
  active_users_today: number;
  requests_per_day: DailyPoint[];
  users_per_day: DailyPoint[];
  role_distribution: RoleCount[];
  collections_per_day: DailyPoint[];
}

export interface UserUsage {
  email: string;
  role: string;
  daily_limit: number;
  created_at: string;
  total_requests_in_period: number;
  requests_per_day: DailyPoint[];
}
