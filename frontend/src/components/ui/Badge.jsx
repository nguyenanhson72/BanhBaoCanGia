import React from "react";
import { cn } from "../../lib/utils";

const STATUS_STYLES = {
  preparing: "bg-status-preparing-bg text-status-preparing-text border-status-preparing-border",
  delivering: "bg-status-delivering-bg text-status-delivering-text border-status-delivering-border",
  delivered: "bg-status-delivered-bg text-status-delivered-text border-status-delivered-border",
  cancelled: "bg-status-cancelled-bg text-status-cancelled-text border-status-cancelled-border",
  lowstock: "bg-status-lowstock-bg text-status-lowstock-text border-status-lowstock-border",
  vip: "bg-amber-50 text-amber-800 border-amber-200",
  regular: "bg-blue-50 text-blue-700 border-blue-200",
  new: "bg-emerald-50 text-emerald-700 border-emerald-200",
  admin: "bg-bamboo text-white border-bamboo",
  manager: "bg-terracotta text-white border-terracotta",
  staff: "bg-cream text-ink border-border",
};

export function Badge({ variant = "regular", className = "", children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap",
        STATUS_STYLES[variant] || STATUS_STYLES.regular,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
