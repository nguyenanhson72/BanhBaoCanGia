import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input, Label } from "../components/ui/Input";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../contexts/I18nContext";
import { toast } from "../components/ui/Toast";

function formatApiErrorDetail(detail) {
  if (detail == null) return null;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default function Login() {
  const { login } = useAuth();
  const { t, lang, toggleLang } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@banhbao.vn");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      toast({ title: t("common.welcome"), variant: "success" });
      navigate("/dashboard");
    } catch (e) {
      setError(formatApiErrorDetail(e?.response?.data?.detail) || t("auth.invalid"));
    } finally {
      setLoading(false);
    }
  };

  const onGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left - Brand */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-bamboo text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1726981897420-0778c14deedf?w=1200')" }}
        />
        <div className="absolute inset-0 bg-bamboo/70" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="font-heading font-bold text-2xl">Bánh Bao</div>
              <div className="text-xs uppercase tracking-widest text-white/70">Admin Panel</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 space-y-4 max-w-md">
          <h2 className="font-heading text-4xl font-bold leading-tight">
            {lang === "vi"
              ? "Quản lý tiệm bánh bao chuyên nghiệp, mọi lúc mọi nơi."
              : "Run your steamed bun shop professionally, anywhere."}
          </h2>
          <p className="text-white/80 leading-relaxed">
            {lang === "vi"
              ? "Theo dõi doanh thu, đơn hàng, tồn kho và khách hàng — tất cả trong một giao diện hiện đại, dễ sử dụng."
              : "Track revenue, orders, inventory, and customers — all in one modern, easy-to-use interface."}
          </p>
        </div>
        <div className="relative z-10 text-xs text-white/60">
          © {new Date().getFullYear()} Bánh Bao Admin
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 md:px-12 py-12 bg-white">
        <div className="max-w-md w-full mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-bamboo flex items-center justify-center text-white">
                <Sparkles size={18} />
              </div>
              <div className="font-heading font-bold text-lg">Bánh Bao</div>
            </div>
            <button
              type="button"
              onClick={toggleLang}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-ink-secondary border border-border hover:border-bamboo hover:text-ink uppercase tracking-wide transition-colors"
              data-testid="login-lang-toggle"
              aria-label="Toggle language"
            >
              {lang === "vi" ? "EN" : "VI"}
            </button>
          </div>

          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-bold tracking-tight">{t("auth.loginTitle")}</h1>
            <p className="text-sm text-ink-secondary">{t("auth.loginSubtitle")}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-11"
                  data-testid="login-email-input"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 h-11"
                  data-testid="login-password-input"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div
                className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
                data-testid="login-error"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full h-11"
              disabled={loading}
              data-testid="login-submit-button"
            >
              {loading ? t("common.loading") : t("auth.submit")}
              <ArrowRight size={16} />
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-ink-muted uppercase tracking-wider">
                {t("auth.or")}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="lg"
            className="w-full h-11"
            onClick={onGoogleLogin}
            data-testid="login-google-button"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.547 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            {t("auth.googleLogin")}
          </Button>

          <div className="text-center text-xs text-ink-muted">
            {lang === "vi"
              ? "Tài khoản demo: "
              : "Demo account: "}
            <span className="font-mono text-ink">admin@banhbao.vn / admin123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
