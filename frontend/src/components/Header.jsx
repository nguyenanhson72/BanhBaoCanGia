import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Globe, LogOut, ChevronDown, Bell } from "lucide-react";
import { useI18n } from "../contexts/I18nContext";
import { useAuth } from "../contexts/AuthContext";

export default function Header({ onMenu }) {
  const { lang, toggleLang, t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const onLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initial = (user?.name || user?.email || "U").charAt(0).toUpperCase();

  return (
    <header
      className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 md:px-6 bg-white/80 backdrop-blur-xl border-b border-border"
      data-testid="header"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          className="md:hidden p-2 rounded-md hover:bg-cream"
          data-testid="header-menu-button"
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="hidden sm:block font-heading text-base font-semibold text-ink">
          {t("brand")}
        </h1>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-ink-secondary hover:bg-cream transition-colors"
          data-testid="header-lang-toggle"
          aria-label="Toggle language"
        >
          <Globe size={14} />
          <span className="uppercase">{lang}</span>
        </button>

        <button
          className="relative p-2 rounded-md hover:bg-cream text-ink-secondary"
          data-testid="header-notifications"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-terracotta rounded-full" />
        </button>

        <div ref={ref} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-cream"
            data-testid="header-user-menu"
          >
            {user?.picture ? (
              <img
                src={user.picture}
                alt=""
                className="w-7 h-7 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-bamboo text-white flex items-center justify-center text-xs font-bold">
                {initial}
              </div>
            )}
            <div className="hidden md:block leading-tight text-left">
              <div className="text-xs font-semibold text-ink">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                {user?.role}
              </div>
            </div>
            <ChevronDown size={14} className="text-ink-muted" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-56 bg-white border border-border rounded-lg shadow-lg overflow-hidden animate-fade-in"
              data-testid="header-user-dropdown"
            >
              <div className="px-4 py-3 border-b border-border">
                <div className="text-sm font-semibold text-ink">{user?.name}</div>
                <div className="text-xs text-ink-muted truncate">{user?.email}</div>
              </div>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink hover:bg-cream"
                data-testid="header-logout-button"
              >
                <LogOut size={14} />
                {t("common.logout")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
