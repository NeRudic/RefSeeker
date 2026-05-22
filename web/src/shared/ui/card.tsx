import { cn } from "@/shared/lib/cn";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "solid";
}

export function Card({
  className,
  variant = "glass",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl p-5 transition-all duration-200",
        variant === "glass" && "glass",
        variant === "solid" && "bg-surface-900 border border-surface-800",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
