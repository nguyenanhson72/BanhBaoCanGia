import React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef(({ className = "", ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "w-full h-9 px-3 py-2 text-sm bg-white border border-border rounded-md placeholder:text-ink-muted",
      "focus:border-bamboo focus:ring-1 focus:ring-bamboo outline-none transition-all",
      className
    )}
    {...props}
  />
));

export const Textarea = React.forwardRef(({ className = "", ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full px-3 py-2 text-sm bg-white border border-border rounded-md placeholder:text-ink-muted",
      "focus:border-bamboo focus:ring-1 focus:ring-bamboo outline-none transition-all min-h-[80px]",
      className
    )}
    {...props}
  />
));

export const Select = React.forwardRef(({ className = "", children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "w-full h-9 px-3 py-2 text-sm bg-white border border-border rounded-md",
      "focus:border-bamboo focus:ring-1 focus:ring-bamboo outline-none transition-all",
      className
    )}
    {...props}
  >
    {children}
  </select>
));

export function Label({ className = "", children, ...props }) {
  return (
    <label className={cn("block text-xs font-medium text-ink-secondary mb-1.5", className)} {...props}>
      {children}
    </label>
  );
}
