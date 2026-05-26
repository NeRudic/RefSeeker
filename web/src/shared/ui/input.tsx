import { cn } from "@/shared/lib/cn";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({
  className,
  label,
  error,
  id,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-medium text-text-secondary mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "w-full h-12 px-4 rounded-xl bg-white/[0.04] border border-border text-text-primary",
          "placeholder:text-text-muted",
          "transition-all duration-200",
          "focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/30 focus:bg-white/[0.06]",
          "disabled:opacity-30 disabled:cursor-not-allowed",
          error && "border-red-500/40 focus:border-red-500 focus:ring-red-500/30",
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
