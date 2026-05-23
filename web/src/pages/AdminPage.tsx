import { useState, useEffect } from "react";
import { useAuth } from "@/app/auth-context";
import { Shield, Loader2, Check, X } from "lucide-react";
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
  free: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
  pro: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  premium: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  admin: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
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
      setTotal(data.total);
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

  if (user?.role !== "admin") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <p className="text-neutral-500">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-6 w-6 text-red-400" />
        <h1 className="text-2xl font-bold text-neutral-100">Admin Panel</h1>
        <span className="text-sm text-neutral-500">
          {total} user{total === 1 ? "" : "s"}
        </span>
      </div>

      {error && (
        <div className="mb-6 glass rounded-xl p-4 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
        </div>
      ) : users.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-neutral-600">No users found.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Usage Today</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Daily Limit</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-neutral-200 font-medium">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                          disabled={savingId === u.id}
                          className={`rounded-lg px-2 py-1 text-xs font-medium border transition-colors cursor-pointer ${ROLE_COLORS[u.role]} bg-transparent`}
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role} className="bg-neutral-900 text-neutral-200">
                              {role}
                            </option>
                          ))}
                        </select>
                        {savingId === u.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500" />}
                        {successId === u.id && <Check className="h-3.5 w-3.5 text-green-400" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-neutral-400 tabular-nums">{u.usage_today}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-neutral-400 tabular-nums">
                        {u.daily_limit === -1 ? "∞" : u.daily_limit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
