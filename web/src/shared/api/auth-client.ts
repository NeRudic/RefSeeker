import type { AuthTokens, LoginRequest, MeResponse, RegisterRequest, User } from "@/entities/user";

const BASE = "/api/auth";

export async function registerUser(
  data: RegisterRequest
): Promise<{ user: User } & AuthTokens> {
  const res = await fetch(`${BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(err.detail || "Registration failed");
  }
  return res.json();
}

export async function loginUser(
  data: LoginRequest
): Promise<{ user: User } & AuthTokens> {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
}

export async function refreshTokens(
  refreshToken: string
): Promise<AuthTokens> {
  const res = await fetch(`${BASE}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  return res.json();
}

export async function getMe(): Promise<MeResponse> {
  const token = localStorage.getItem("access_token");
  if (!token) {
    return { authenticated: false, usage_today: 0, daily_limit: 1, remaining: 1 };
  }
  const res = await fetch(`${BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return { authenticated: false, usage_today: 0, daily_limit: 1, remaining: 1 };
  }
  return res.json();
}
