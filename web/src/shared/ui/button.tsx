import { cn } from "@/shared/lib/cn";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base-900",
        "disabled:opacity-30 disabled:pointer-events-none",
        {
          primary:
            "accent-gradient text-white hover:opacity-90 active:opacity-80 shadow-lg shadow-accent-500/20",
          secondary:
            "glass glass-hover text-text-secondary hover:text-text-primary",
          ghost:
            "text-text-muted hover:text-text-secondary hover:bg-white/[0.04]",
          danger:
            "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/15",
        }[variant],
        {
          sm: "h-8 px-3 text-xs",
          md: "h-10 px-4 text-sm",
          lg: "h-12 px-6 text-sm",
        }[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
