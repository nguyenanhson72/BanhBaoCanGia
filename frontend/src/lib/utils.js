// Lightweight utility for combining classNames
export function cn(...inputs) {
  return inputs
    .flat(Infinity)
    .filter(Boolean)
    .join(" ");
}

export function formatVND(value) {
  if (value == null || isNaN(value)) return "0₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(value, lang = "vi") {
  if (!value) return "";
  const d = new Date(value);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return lang === "vi" ? "vừa xong" : "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}${lang === "vi" ? " phút trước" : "m ago"}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${lang === "vi" ? " giờ trước" : "h ago"}`;
  return formatDate(value);
}
