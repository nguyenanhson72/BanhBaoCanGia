import React, { useEffect, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

let toastListeners = [];
let toastId = 0;

export function toast({ title, description = "", variant = "success", duration = 3500 }) {
  const id = ++toastId;
  toastListeners.forEach((l) => l({ id, title, description, variant, duration }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, t.duration);
    };
    toastListeners.push(handler);
    return () => {
      toastListeners = toastListeners.filter((h) => h !== handler);
    };
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const ICONS = {
    success: <CheckCircle2 size={18} className="text-emerald-600" />,
    error: <AlertCircle size={18} className="text-red-600" />,
    info: <Info size={18} className="text-blue-600" />,
  };

  return (
    <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2" data-testid="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-3 bg-white border border-border rounded-lg shadow-lg p-4 min-w-[280px] max-w-md",
            "animate-slide-up"
          )}
          data-testid={`toast-${t.variant}`}
        >
          {ICONS[t.variant] || ICONS.info}
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink">{t.title}</div>
            {t.description && (
              <div className="text-xs text-ink-secondary mt-0.5">{t.description}</div>
            )}
          </div>
          <button onClick={() => dismiss(t.id)} className="text-ink-muted hover:text-ink">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
