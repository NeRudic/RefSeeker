import { cn } from "@/shared/lib/cn";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "glass-deep" | "solid" | "accent";
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
        variant === "glass-deep" && "glass-deep",
        variant === "solid" && "bg-surface-2 border border-border",
        variant === "accent" && "glass accent-border",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
