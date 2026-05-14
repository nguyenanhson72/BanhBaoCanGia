import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Searchable combobox that filters items by typing.
 *
 * Props:
 *  - items: array of objects
 *  - value: selected id (string)
 *  - onChange: (id, item) => void
 *  - getKey: (item) => string (default item.id)
 *  - getLabel: (item) => string (default item.name)
 *  - renderItem: (item) => ReactNode for custom row rendering
 *  - placeholder: string
 *  - searchKeys: array of keys to match against (default ["name", "phone", "sku"])
 *  - testId: string for data-testid
 */
export default function Combobox({
  items = [],
  value,
  onChange,
  getKey = (i) => i.id,
  getLabel = (i) => i.name,
  renderItem,
  placeholder = "Tìm kiếm...",
  searchKeys = ["name", "phone", "sku", "code"],
  testId = "combobox",
  emptyLabel = "Không tìm thấy",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const selected = items.find((it) => getKey(it) === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((it) => {
        for (const k of searchKeys) {
          const v = it[k];
          if (v && String(v).toLowerCase().includes(q)) return true;
        }
        return false;
      })
    : items;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "w-full h-9 px-3 pr-8 text-sm bg-white border border-border rounded-md text-left",
          "focus:border-bamboo focus:ring-1 focus:ring-bamboo outline-none transition-all",
          "flex items-center justify-between gap-2",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        data-testid={`${testId}-trigger`}
      >
        <span className={cn("truncate", !selected && "text-ink-muted")}>
          {selected ? getLabel(selected) : placeholder}
        </span>
        <ChevronDown size={14} className="text-ink-muted shrink-0" />
      </button>

      {open && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg overflow-hidden animate-fade-in"
          data-testid={`${testId}-dropdown`}
        >
          <div className="relative border-b border-border">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full h-9 pl-8 pr-8 text-sm bg-white outline-none"
              data-testid={`${testId}-search`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-ink-muted">{emptyLabel}</div>
            ) : (
              filtered.map((it) => {
                const key = getKey(it);
                const active = key === value;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => {
                      onChange(key, it);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-cream transition-colors flex items-center justify-between gap-2",
                      active && "bg-cream/70 text-bamboo font-medium"
                    )}
                    data-testid={`${testId}-option-${key}`}
                  >
                    {renderItem ? renderItem(it) : <span>{getLabel(it)}</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
