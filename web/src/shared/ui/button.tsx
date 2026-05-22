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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
        "disabled:opacity-40 disabled:pointer-events-none",
        {
          primary:
            "bg-accent-600 text-white hover:bg-accent-500 active:bg-accent-700 shadow-lg shadow-accent-600/20",
          secondary:
            "glass glass-hover text-neutral-200",
          ghost:
            "text-neutral-400 hover:text-neutral-200 hover:bg-white/5",
          danger:
            "bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30",
        }[variant],
        {
          sm: "h-8 px-3 text-sm",
          md: "h-10 px-4 text-sm",
          lg: "h-12 px-6 text-base",
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
