import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Truck,
  UserCog,
  BarChart3,
  Settings,
  Sparkles,
} from "lucide-react";
import { useI18n } from "../contexts/I18nContext";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, key: "dashboard", testId: "nav-dashboard" },
  { to: "/orders", icon: ShoppingBag, key: "orders", testId: "nav-orders" },
  { to: "/products", icon: Package, key: "products", testId: "nav-products" },
  { to: "/customers", icon: Users, key: "customers", testId: "nav-customers" },
  { to: "/suppliers", icon: Truck, key: "suppliers", testId: "nav-suppliers" },
  { to: "/users", icon: UserCog, key: "users", testId: "nav-users", roles: ["admin", "manager"] },
  { to: "/reports", icon: BarChart3, key: "reports", testId: "nav-reports" },
  { to: "/settings", icon: Settings, key: "settings", testId: "nav-settings" },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  const items = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  );

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={onClose}
          data-testid="sidebar-backdrop"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 bg-cream border-r border-border flex flex-col transition-transform duration-200",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div
          className="px-5 py-5 border-b border-border/70 cursor-pointer"
          onClick={() => navigate("/dashboard")}
          data-testid="sidebar-logo"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-bamboo flex items-center justify-center text-white shadow-sm">
              <Sparkles size={20} strokeWidth={2.2} />
            </div>
            <div className="leading-tight">
              <div className="font-heading font-bold text-base text-ink">Bánh Bao</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-muted">
                Admin Panel
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                data-testid={item.testId}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-bamboo text-white shadow-sm"
                      : "text-ink-secondary hover:bg-cream-dark hover:text-ink"
                  )
                }
              >
                <Icon size={18} strokeWidth={2} />
                <span>{t(`nav.${item.key}`)}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border/70 text-[11px] text-ink-muted">
          v0.1 · {t("tagline")}
        </div>
      </aside>
    </>
  );
}
