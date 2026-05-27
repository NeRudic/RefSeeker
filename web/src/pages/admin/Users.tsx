import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client";
import { EmptyState } from "../../components/EmptyState";
import { Loader2, UsersIcon, ChevronLeft, ChevronRight, AlertTriangle, Check } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  usage_today: number;
  daily_limit: number;
}

interface UserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  per_page: number;
}

const ROLES = ["free", "pro", "premium", "admin"] as const;
const PER_PAGE = 20;

export function Users() {
  const [data, setData] = useState<UserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [updatedRoles, setUpdatedRoles] = useState<Record<string, string>>({});

  const loadUsers = (p: number) => {
    setLoading(true);
    setError("");
    apiGet<UserListResponse>(`/admin/users?page=${p}&per_page=${PER_PAGE}`)
      .then(setData)
      .catch(() => setError("Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers(page);
  }, [page]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingRole(userId);
    try {
      await apiPatch(`/admin/users/${userId}/role`, { role: newRole });
      setUpdatedRoles((prev) => ({ ...prev, [userId]: newRole }));
    } catch {
      // silently fail, role stays unchanged in UI
    } finally {
      setUpdatingRole(null);
    }
  };

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-accent-400 animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <EmptyState
        icon={<AlertTriangle size={24} />}
        title="Failed to load users"
        description={error}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Users</h1>
        {data && (
          <span className="text-sm text-zinc-500">{data.total} total</span>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-obsidian-700/50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Role</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Usage Today</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Limit</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map((user) => {
                const currentRole = updatedRoles[user.id] || user.role;
                const isUpdating = updatingRole === user.id;
                return (
                  <tr key={user.id} className="border-b border-obsidian-700/30 hover:bg-obsidian-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-zinc-200 font-medium">{user.email}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <select
                          value={currentRole}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={isUpdating}
                          className="bg-obsidian-850 border border-obsidian-700 rounded-md px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-accent-500 disabled:opacity-50"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        {isUpdating && <Loader2 size={12} className="text-accent-400 animate-spin" />}
                        {updatedRoles[user.id] && !isUpdating && <Check size={12} className="text-emerald-400" />}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-300">
                      {user.usage_today}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-500">
                      {user.daily_limit === -1 ? "∞" : user.daily_limit}
                    </td>
                    <td className="py-3 px-4 text-zinc-500 text-xs">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
              {data && data.users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="ghost-button !p-2 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-zinc-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="ghost-button !p-2 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
