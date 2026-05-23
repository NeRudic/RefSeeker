import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import {
  Activity, Users, Image, Calendar, Search,
  Mail, ChevronDown, Loader2, AlertCircle,
  BarChart3, PieChart as PieIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { UsageSummary, UserUsage, DailyPoint, RoleCount } from "@/entities/user";

// ── Colors ─────────────────────────────────────────────────────────────

const ACCENT = "#818cf8";
const ACCENT_STOPS = ["#818cf8", "#6366f1"];
const NEUTRAL = "#525252";
const GRID = "#262626";
const TOOLTIP_BG = "rgba(23, 23, 23, 0.95)";

const PIE_COLORS: Record<string, string> = {
  admin: "#ef4444",
  premium: "#a855f7",
  pro: "#3b82f6",
  free: "#525252",
};

// ── Helpers ────────────────────────────────────────────────────────────

function adminFetch(path: string): Promise<Response> {
  const token = localStorage.getItem("access_token");
  return fetch(`/api/admin${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const roleLabel: Record<string, string> = {
  admin: "Admin",
  premium: "Premium",
  pro: "Pro",
  free: "Free",
};

// ── Tooltip components ──────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit = "" }: { active?: boolean; payload?: { value: number }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl border border-white/5">
      <p className="text-neutral-400 mb-0.5">{label}</p>
      <p className="text-neutral-100 font-semibold tabular-nums">
        {fmt(payload[0].value)}{unit}
      </p>
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl border border-white/5">
      <p className="text-neutral-100 font-semibold tabular-nums">
        {payload[0].name}: {payload[0].value}
      </p>
    </div>
  );
}

// ── Custom ticks ───────────────────────────────────────────────────────

function DateTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (!x || !y || !payload) return null;
  return (
    <text x={x} y={y + 14} textAnchor="middle" fill={NEUTRAL} fontSize={10} fontFamily="inherit">
      {formatDateLabel(payload.value)}
    </text>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="glass rounded-2xl p-5 animate-pulse">
      <div className="h-3 w-20 bg-white/5 rounded mb-3" />
      <div className="h-7 w-24 bg-white/10 rounded" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="glass rounded-2xl p-6 animate-pulse">
      <div className="h-3 w-32 bg-white/5 rounded mb-6" />
      <div className="h-48 w-full bg-white/[0.02] rounded-xl" />
    </div>
  );
}

// ── Summary Card ───────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, delay, color }: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  delay: number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className="glass rounded-2xl p-5 group hover:bg-white/[0.06] transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
          {label}
        </span>
        <div className={cn("rounded-lg p-2 transition-colors", color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <span className="text-2xl font-bold text-neutral-100 tabular-nums tracking-tight">
        {typeof value === "number" ? fmt(value) : value}
      </span>
    </motion.div>
  );
}

// ── Section Header ─────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: typeof Activity; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className="rounded-lg bg-accent-500/10 p-2">
        <Icon className="h-4 w-4 text-accent-400" />
      </div>
      <h2 className="text-sm font-semibold text-neutral-200">{title}</h2>
    </div>
  );
}

// ── Chart wrapper ──────────────────────────────────────────────────────

function ChartCard({ title, children, delay, className }: {
  title: string;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay ?? 0, duration: 0.5, ease: "easeOut" }}
      className={cn("glass rounded-2xl p-6", className)}
    >
      <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-6">
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Calendar className="h-10 w-10 text-neutral-600 mb-3" />
      <p className="text-sm text-neutral-500">{message}</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  // Date range
  const [fromDate, setFromDate] = useState(thirtyDaysAgoISO);
  const [toDate, setToDate] = useState(todayISO);

  // User search
  const [searchEmail, setSearchEmail] = useState("");
  const [userUsage, setUserUsage] = useState<UserUsage | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState("");

  // ── Fetch summary ───────────────────────────────────────────────────
  const fetchSummary = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFetch(`/usage/summary?from=${f}&to=${t}`);
      if (!res.ok) throw new Error("Failed to load usage data");
      setSummary(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load usage data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(fromDate, toDate);
  }, [fromDate, toDate, fetchSummary]);

  // ── Search user ─────────────────────────────────────────────────────
  const handleUserSearch = async () => {
    const email = searchEmail.trim();
    setUserUsage(null);
    setUserError("");
    setUserLoading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (email) params.set("email", email);
      const res = await adminFetch(`/usage/user?${params}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as { detail?: string }).detail || "User not found");
      }
      setUserUsage(await res.json());
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Failed to load user usage");
    } finally {
      setUserLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────

  const commonChartProps = {
    stroke: "none",
    fill: ACCENT,
    fillOpacity: 1,
    radius: [4, 4, 0, 0] as [number, number, number, number],
    maxBarSize: 32,
  };

  return (
    <div className="space-y-8">
      {/* ── Date Range Picker ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass rounded-2xl p-5"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-accent-400" />
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Period
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="appearance-none bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-neutral-200 font-medium tabular-nums focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors [color-scheme:dark]"
              />
            </div>
            <span className="text-xs text-neutral-600">—</span>
            <div className="relative">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="appearance-none bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs text-neutral-200 font-medium tabular-nums focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors [color-scheme:dark]"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            {["7d", "30d", "90d", "1y"].map((preset) => {
              const days = preset === "7d" ? 6 : preset === "30d" ? 29 : preset === "90d" ? 89 : 364;
              return (
                <button
                  key={preset}
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - days);
                    setFromDate(d.toISOString().slice(0, 10));
                    setToDate(todayISO());
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    fromDate === thirtyDaysAgoISO() && preset === "30d"
                      ? "bg-accent-500/15 text-accent-400 border border-accent-500/20"
                      : "text-neutral-500 hover:text-neutral-300 border border-transparent hover:border-white/10"
                  )}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ── Error ──────────────────────────────────────────────────── */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-2xl p-4 border border-red-500/20 flex items-center gap-3"
        >
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </motion.div>
      )}

      {/* ── Summary Cards ───────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={Activity}
            label="Total Requests"
            value={summary.total_requests}
            delay={0}
            color="bg-accent-500/10 text-accent-400"
          />
          <SummaryCard
            icon={Users}
            label="Active Today"
            value={summary.active_users_today}
            delay={0.05}
            color="bg-emerald-500/10 text-emerald-400"
          />
          <SummaryCard
            icon={Users}
            label="Total Users"
            value={summary.total_users}
            delay={0.1}
            color="bg-blue-500/10 text-blue-400"
          />
          <SummaryCard
            icon={Image}
            label="Collections"
            value={summary.total_collections}
            delay={0.15}
            color="bg-purple-500/10 text-purple-400"
          />
        </div>
      ) : null}

      {/* ── Charts Section ─────────────────────────────────────────── */}
      <SectionHeader icon={BarChart3} title="Overview" />

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Requests per day */}
          <ChartCard title="Requests per day" delay={0.05}>
            {summary.requests_per_day.length === 0 ? (
              <EmptyState message="No requests in this period" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={summary.requests_per_day} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={<DateTick />} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: NEUTRAL, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: NEUTRAL, strokeDasharray: "4 4" }} />
                  <Area type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2} fill="url(#reqGrad)" dot={false} activeDot={{ r: 4, fill: ACCENT, stroke: "transparent" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Active users per day */}
          <ChartCard title="Active users per day" delay={0.1}>
            {summary.users_per_day.length === 0 ? (
              <EmptyState message="No active users in this period" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={summary.users_per_day} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={<DateTick />} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: NEUTRAL, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: NEUTRAL, strokeDasharray: "4 4" }} />
                  <Area type="monotone" dataKey="count" stroke="#34d399" strokeWidth={2} fill="url(#usersGrad)" dot={false} activeDot={{ r: 4, fill: "#34d399", stroke: "transparent" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Collections per day */}
          <ChartCard title="Collections created per day" delay={0.15}>
            {summary.collections_per_day.length === 0 ? (
              <EmptyState message="No collections created in this period" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={summary.collections_per_day} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="date" tick={<DateTick />} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: NEUTRAL, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="count" {...commonChartProps} fill="#a78bfa" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Role distribution */}
          <ChartCard title="Users by role" delay={0.2}>
            {summary.role_distribution.length === 0 ? (
              <EmptyState message="No users registered" />
            ) : (
              <div className="flex items-center h-[220px]">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie
                      data={summary.role_distribution.map((r: RoleCount) => ({ ...r, name: roleLabel[r.role] || r.role }))}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={3}
                      stroke="transparent"
                    >
                      {summary.role_distribution.map((entry: RoleCount) => (
                        <Cell key={entry.role} fill={PIE_COLORS[entry.role] || "#525252"} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="space-y-2.5">
                  {summary.role_distribution.map((entry: RoleCount) => (
                    <div key={entry.role} className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[entry.role] || "#525252" }}
                      />
                      <span className="text-xs text-neutral-400">{roleLabel[entry.role] || entry.role}</span>
                      <span className="text-xs text-neutral-100 font-semibold tabular-nums">{entry.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>
        </div>
      ) : null}

      {/* ── User Search Section ─────────────────────────────────────── */}
      <SectionHeader icon={Search} title="User Search" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5, ease: "easeOut" }}
        className="glass rounded-2xl p-5"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="email"
              placeholder="Enter user email (leave empty for unauthorized usage)"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUserSearch()}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors"
            />
          </div>
          <button
            onClick={handleUserSearch}
            disabled={userLoading}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium bg-accent-600 text-white hover:bg-accent-500 disabled:opacity-50 transition-colors shrink-0"
          >
            {userLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {userLoading ? "Searching..." : "Search"}
          </button>
        </div>

        {userError && (
          <p className="mt-3 text-xs text-red-400 flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3" />
            {userError}
          </p>
        )}

        {userUsage && !userError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.3 }}
            className="mt-5 space-y-5"
          >
            {/* User info card */}
            <div className="glass rounded-xl p-4 border border-white/[0.04]">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-accent-500/10 p-2">
                    <Mail className="h-4 w-4 text-accent-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-200">
                      {userUsage.email === "__unauthorized__" ? "Unauthorized Users" : userUsage.email}
                    </p>
                    {userUsage.email !== "__unauthorized__" && (
                      <p className="text-[11px] text-neutral-500">
                        Joined {new Date(userUsage.created_at).toLocaleDateString("en-US", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                  {userUsage.email !== "__unauthorized__" && (
                    <>
                      <span className={cn(
                        "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider border",
                        userUsage.role === "admin" && "bg-red-500/10 text-red-400 border-red-500/20",
                        userUsage.role === "premium" && "bg-purple-500/10 text-purple-400 border-purple-500/20",
                        userUsage.role === "pro" && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                        userUsage.role === "free" && "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
                      )}>
                        {userUsage.role}
                      </span>
                      <div className="text-right">
                        <p className="text-[11px] text-neutral-500">Daily limit</p>
                        <p className="text-xs font-semibold text-neutral-200 tabular-nums">
                          {userUsage.daily_limit === -1 ? "∞" : userUsage.daily_limit}
                        </p>
                      </div>
                    </>
                  )}
                  <div className="text-right">
                    <p className="text-[11px] text-neutral-500">Total in period</p>
                    <p className="text-lg font-bold text-neutral-100 tabular-nums">
                      {fmt(userUsage.total_requests_in_period)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* User requests chart */}
            {userUsage.requests_per_day.length > 0 ? (
              <div className="glass rounded-xl p-4 border border-white/[0.04]">
                <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-4">
                  Requests per day
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={userUsage.requests_per_day} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="userReqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={<DateTick />} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: NEUTRAL, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: NEUTRAL, strokeDasharray: "4 4" }} />
                    <Area type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2} fill="url(#userReqGrad)" dot={false} activeDot={{ r: 4, fill: ACCENT, stroke: "transparent" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="glass rounded-xl p-6 border border-white/[0.04]">
                <EmptyState message="No requests from this user in the selected period" />
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
