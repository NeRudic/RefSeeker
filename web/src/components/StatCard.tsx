import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
}

export function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div className="glass-card-hover p-5 flex items-start justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        <span className="text-2xl font-bold text-zinc-100">{value}</span>
        {trend && <span className="text-xs text-zinc-500 mt-0.5">{trend}</span>}
      </div>
      <div className="w-10 h-10 rounded-xl bg-accent-500/15 border border-accent-500/25 flex items-center justify-center text-accent-400">
        {icon}
      </div>
    </div>
  );
}
