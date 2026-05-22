import { cn } from "@/shared/lib/cn";
import type { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info";
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          default: "bg-white/5 text-neutral-400",
          success: "bg-emerald-500/10 text-emerald-400",
          warning: "bg-amber-500/10 text-amber-400",
          error: "bg-red-500/10 text-red-400",
          info: "bg-accent-500/10 text-accent-400",
        }[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
