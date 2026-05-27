import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-obsidian-800 border border-obsidian-700 flex items-center justify-center text-zinc-500 mb-5">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-zinc-300 mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}
