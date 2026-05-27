import { useEffect, useState } from "react";
import { apiGet } from "../../api/client";
import { StatCard } from "../../components/StatCard";
import { EmptyState } from "../../components/EmptyState";
import {
  Loader2,
  BarChart3,
  Users,
  Image,
  Activity,
  AlertTriangle,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DailyPoint {
  date: string;
  count: number;
}

interface RoleCount {
  role: string;
  count: number;
}

interface SummaryData {
  total_requests: number;
  total_users: number;
  total_collections: number;
  active_users_today: number;
  requests_per_day: DailyPoint[];
  users_per_day: DailyPoint[];
  role_distribution: RoleCount[];
  collections_per_day: DailyPoint[];
}

const ROLE_COLORS: Record<string, string> = {
  admin: "#6366f1",
  premium: "#8b5cf6",
  pro: "#a78bfa",
  free: "#c4b5fd",
  anonymous: "#3f3f46",
};

function formatDate(dateStr: string): string {
  if (dateStr.length === 10) {
    const [, m, d] = dateStr.split("-");
    return `${m}/${d}`;
  }
  return dateStr;
}

export function Dashboard() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<SummaryData>("/admin/usage/summary")
      .then(setData)
      .catch(() => setError("Failed to load dashboard data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-accent-400 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<AlertTriangle size={24} />}
        title="Failed to load dashboard"
        description={error || "No data available"}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-8">
      <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Requests"
          value={data.total_requests.toLocaleString()}
          icon={<Activity size={20} />}
        />
        <StatCard
          label="Active Today"
          value={data.active_users_today}
          icon={<Users size={20} />}
          trend={`${data.total_users} registered`}
        />
        <StatCard
          label="Collections"
          value={data.total_collections}
          icon={<Image size={20} />}
        />
        <StatCard
          label="Role Distribution"
          value={`${data.role_distribution.length} roles`}
          icon={<BarChart3 size={20} />}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Requests per day — area chart */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Requests per Day</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.requests_per_day}>
                <defs>
                  <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#52525b"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis stroke="#52525b" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#e4e4e7",
                  }}
                  labelFormatter={formatDate}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#818cf8"
                  strokeWidth={2}
                  fill="url(#requestsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Users per day — line chart */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Active Users per Day</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.users_per_day}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#52525b"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis stroke="#52525b" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#e4e4e7",
                  }}
                  labelFormatter={formatDate}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#a78bfa", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Collections per day — bar chart */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Collections per Day</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.collections_per_day}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#52525b"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis stroke="#52525b" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#e4e4e7",
                  }}
                  labelFormatter={formatDate}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Role distribution — pie chart */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Role Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            {data.role_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.role_distribution}
                    dataKey="count"
                    nameKey="role"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {data.role_distribution.map((entry) => (
                      <Cell
                        key={entry.role}
                        fill={ROLE_COLORS[entry.role] || "#52525b"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#e4e4e7",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-zinc-500">No data</p>
            )}
          </div>
          <div className="flex flex-wrap gap-4 justify-center mt-2">
            {data.role_distribution.map((entry) => (
              <div key={entry.role} className="flex items-center gap-2 text-xs text-zinc-400">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: ROLE_COLORS[entry.role] || "#52525b" }}
                />
                {entry.role} ({entry.count})
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
