import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiGet, apiPost, setTokens, clearTokens, getAccessToken } from "../api/client";

export interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
  usage_today: number;
  daily_limit: number;
}

interface AuthState {
  user: User | null;
  authenticated: boolean;
  loading: boolean;
  usageToday: number;
  dailyLimit: number;
  remaining: number;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [usageToday, setUsageToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(1);
  const [remaining, setRemaining] = useState(1);

  const refreshMe = useCallback(async () => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiGet<{
        authenticated: boolean;
        user?: User;
        usage_today: number;
        daily_limit: number;
        remaining: number;
      }>("/auth/me");
      if (data.authenticated && data.user) {
        setUser(data.user);
        setUsageToday(data.usage_today);
        setDailyLimit(data.daily_limit);
        setRemaining(data.remaining);
      } else {
        setUser(null);
        setUsageToday(data.usage_today);
        setDailyLimit(data.daily_limit);
        setRemaining(data.remaining);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (email: string, password: string) => {
    const data = await apiPost<{
      access_token: string;
      refresh_token: string;
    }>("/auth/login", { email, password });
    setTokens(data.access_token, data.refresh_token);
    await refreshMe();
  };

  const register = async (email: string, password: string) => {
    const data = await apiPost<{
      access_token: string;
      refresh_token: string;
    }>("/auth/register", { email, password });
    setTokens(data.access_token, data.refresh_token);
    await refreshMe();
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    setUsageToday(0);
    setDailyLimit(1);
    setRemaining(1);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authenticated: !!user,
        loading,
        usageToday,
        dailyLimit,
        remaining,
        login,
        register,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
