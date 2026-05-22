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
          className="block text-sm font-medium text-neutral-400 mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-neutral-100",
          "placeholder:text-neutral-600",
          "transition-all duration-200",
          "focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/50",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/50",
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
