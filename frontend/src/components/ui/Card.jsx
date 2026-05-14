import React from "react";
import { cn } from "../../lib/utils";

export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-border shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children }) {
  return <div className={cn("px-5 py-4 border-b border-border", className)}>{children}</div>;
}

export function CardTitle({ className = "", children }) {
  return (
    <h3 className={cn("font-heading text-base font-semibold text-ink", className)}>{children}</h3>
  );
}

export function CardContent({ className = "", children }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
