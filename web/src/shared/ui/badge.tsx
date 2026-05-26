import { cn } from "@/shared/lib/cn";
import type { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info" | "accent";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[11px] font-medium",
        {
          default: "bg-white/[0.04] text-text-secondary border border-border",
          success: "bg-success-bg text-success border border-success/15",
          warning: "bg-amber-500/8 text-amber-400 border border-amber-500/15",
          error: "bg-red-500/8 text-red-400 border border-red-500/15",
          info: "bg-blue-500/8 text-blue-400 border border-blue-500/15",
          accent: "bg-accent-500/8 text-accent-400 border border-accent-500/15",
        }[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
