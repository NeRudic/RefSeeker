import { useState, useEffect } from "react";
import { useAuth } from "@/app/auth-context";
import { motion } from "framer-motion";
import { Shield, Loader2, Check, BarChart3, Users } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { AdminDashboard } from "@/widgets/admin-dashboard/AdminDashboard";
import type { UserRole, AdminUser } from "@/entities/user";

const BASE = "/api";

async function fetchAdminUsers(page = 1): Promise<{
  users: AdminUser[];
  total: number;
  page: number;
  per_page: number;
}> {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${BASE}/admin/users?page=${page}&per_page=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

async function updateUserRole(userId: string, role: UserRole): Promise<AdminUser> {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${BASE}/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error("Failed to update role");
  return res.json();
}

const ROLE_OPTIONS: UserRole[] = ["free", "pro", "premium", "admin"];

const ROLE_COLORS: Record<UserRole, string> = {
  free: "bg-white/[0.04] text-text-secondary border-border",
  pro: "bg-blue-500/8 text-blue-400 border-blue-500/15",
  premium: "bg-purple-500/8 text-purple-400 border-purple-500/15",
  admin: "bg-red-500/8 text-red-400 border-red-500/15",
};

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "users", label: "Users", icon: Users },
] as const;

type Tab = (typeof TABS)[number]["key"];

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminUsers();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (targetUser: AdminUser, newRole: UserRole) => {
    if (targetUser.role === newRole) return;
    setSavingId(targetUser.id);
    setSuccessId(null);
    try {
      const updated = await updateUserRole(targetUser.id, newRole);
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? updated : u)));
      setSuccessId(targetUser.id);
      setTimeout(() => setSuccessId(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      {error && (
        <div className="mb-6 glass rounded-xl p-4 border border-red-500/15">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : users.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-text-muted text-sm">No users found.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-text-muted uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-text-muted uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-text-muted uppercase tracking-wider">Usage</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-text-muted uppercase tracking-wider">Limit</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-text-muted uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-text-primary font-medium text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                          disabled={savingId === u.id}
                          className={cn(
                            "rounded-lg px-2 py-1 text-[11px] font-medium border transition-colors cursor-pointer bg-transparent",
                            ROLE_COLORS[u.role]
                          )}
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role} className="bg-surface-2 text-text-primary">
                              {role}
                            </option>
                          ))}
                        </select>
                        {savingId === u.id && <Loader2 className="h-3 w-3 animate-spin text-text-muted" />}
                        {successId === u.id && <Check className="h-3 w-3 text-success" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-text-secondary tabular-nums text-xs">{u.usage_today}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-text-secondary tabular-nums text-xs">
                        {u.daily_limit === -1 ? "∞" : u.daily_limit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-[11px]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  if (user?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-text-muted text-sm">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10">
            <Shield className="h-5 w-5 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Admin Panel</h1>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="glass rounded-2xl p-1.5 mb-8 inline-flex">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all duration-200",
              activeTab === key
                ? "bg-accent-500/15 text-accent-400"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "dashboard" ? <AdminDashboard /> : <UsersTab />}
    </div>
  );
}
