import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { LoginRequest, RegisterRequest, User } from "@/entities/user";
import { getMe, loginUser, registerUser } from "@/shared/api/auth-client";

interface RateLimitInfo {
  remaining: number;
  limit: number;
  used: number;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  rateLimit: RateLimitInfo | null;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const me = await getMe();
      if (me.authenticated && me.user) {
        setUser(me.user);
        setRateLimit({ remaining: me.remaining, limit: me.daily_limit, used: me.usage_today });
      } else {
        setUser(null);
        setRateLimit({ remaining: me.remaining, limit: me.daily_limit, used: me.usage_today });
      }
    } catch {
      setUser(null);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  // Listen for auth:logout event (dispatched by apiFetch on failed refresh)
  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      setRateLimit(null);
    };
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const result = await loginUser(data);
    localStorage.setItem("access_token", result.access_token);
    localStorage.setItem("refresh_token", result.refresh_token);
    setUser(result.user);
    const limit = result.user.daily_limit;
    setRateLimit({ remaining: Math.max(0, limit - result.user.usage_today), limit, used: result.user.usage_today });
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const result = await registerUser(data);
    localStorage.setItem("access_token", result.access_token);
    localStorage.setItem("refresh_token", result.refresh_token);
    setUser(result.user);
    const limit = result.user.daily_limit;
    setRateLimit({ remaining: Math.max(0, limit - result.user.usage_today), limit, used: result.user.usage_today });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    setRateLimit(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        rateLimit,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
