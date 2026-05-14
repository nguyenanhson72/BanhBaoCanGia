import React from "react";
import { cn } from "../../lib/utils";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bamboo focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";
  const variants = {
    primary: "bg-bamboo text-white hover:bg-bamboo-hover",
    secondary: "bg-cream text-ink hover:bg-cream-dark",
    outline: "border border-border bg-white text-ink hover:bg-cream/50",
    ghost: "text-ink hover:bg-cream/60",
    danger: "bg-status-cancelled-text text-white hover:opacity-90",
    terracotta: "bg-terracotta text-white hover:bg-terracotta-hover",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-4 text-sm",
    lg: "h-11 px-6 text-base",
    icon: "h-9 w-9",
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}
