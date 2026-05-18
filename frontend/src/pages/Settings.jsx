import React, { useEffect, useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Input, Label, Select, Textarea } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Upload, Image as ImageIcon, AlertTriangle, RotateCw } from "lucide-react";
import api from "../lib/api";
import { useI18n } from "../contexts/I18nContext";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "../components/ui/Toast";

const MAX_LOGO_BYTES = 300 * 1024;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const DEFAULT = {
  shop_name: "Tiệm Bánh Bao",
  address: "",
  phone: "",
  email: "",
  website: "",
  tax_id: "",
  bank_name: "",
  bank_account: "",
  bank_account_holder: "",
  logo_url: "",
  bill_show_logo: true,
  bill_show_address: true,
  bill_show_phone: true,
  bill_show_email: false,
  bill_show_website: false,
  bill_show_tax_id: false,
  bill_show_bank_qr: true,
  bill_footer_text: "Cảm ơn quý khách. Hẹn gặp lại!",
  default_language: "vi",
};

export default function Settings() {
  const { t, lang, toggleLang } = useI18n();
  const { user } = useAuth();
  const [form, setForm] = useState(DEFAULT);
  const [serverTime, setServerTime] = useState(null);
  const [now, setNow] = useState(new Date());
  const fileRef = useRef(null);

  const refreshTime = async () => {
    try {
      const { data } = await api.get("/system/time");
      setServerTime(data);
    } catch {}
  };

  useEffect(() => {
    api.get("/settings").then(({ data }) => setForm({ ...DEFAULT, ...data }));
    refreshTime();
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      toast({ title: "Logo quá lớn", description: "Tối đa 300KB", variant: "error" });
      return;
    }
    try {
      const b64 = await fileToBase64(file);
      setForm((p) => ({ ...p, logo_url: b64 }));
      toast({ title: "Đã tải logo", variant: "success" });
    } catch {
      toast({ title: "Không đọc được file", variant: "error" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSave = async (e) => {
    e?.preventDefault?.();
    try {
      await api.put("/settings", form);
      toast({ title: t("common.saved"), variant: "success" });
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const onResetDemo = async () => {
    const text = prompt(`${t("settings.resetDemoConfirm")}\n\nGõ "YES_DELETE" để xác nhận:`);
    if (text !== "YES_DELETE") {
      toast({ title: "Đã hủy", variant: "info" });
      return;
    }
    try {
      const { data } = await api.post(`/system/reset-demo?confirm=YES_DELETE`);
      toast({ title: "Đã xóa", description: `Đơn: ${data.deleted.orders}, KH: ${data.deleted.customers}, SP: ${data.deleted.products}`, variant: "success" });
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const billChecks = [
    { key: "bill_show_logo", label: "Logo" },
    { key: "bill_show_address", label: t("common.address") },
    { key: "bill_show_phone", label: t("common.phone") },
    { key: "bill_show_email", label: t("common.email") },
    { key: "bill_show_website", label: t("settings.website") },
    { key: "bill_show_tax_id", label: t("settings.taxId") },
    { key: "bill_show_bank_qr", label: "QR Ngân hàng" },
  ];

  const vnNow = new Date(now.getTime() + (7 * 60 * 60 * 1000) + new Date().getTimezoneOffset() * 60 * 1000);

  return (
    <form onSubmit={onSave} className="space-y-6 animate-fade-in max-w-4xl" data-testid="settings-page">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
          <p className="text-sm text-ink-secondary mt-1">{t("tagline")}</p>
        </div>
        <Button type="submit" data-testid="settings-save">{t("common.save")}</Button>
      </div>

      {/* Server time card */}
      <Card data-testid="settings-server-time">
        <CardContent>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-muted">{t("settings.serverTime")}</div>
              <div className="font-heading text-xl font-bold mt-0.5">
                {serverTime ? new Date(serverTime.utc).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "..."}
              </div>
              <div className="text-xs text-ink-muted mt-1">
                Trình duyệt: <span className="font-mono">{now.toLocaleString("vi-VN")}</span>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={refreshTime} data-testid="settings-refresh-time">
              <RotateCw size={14} /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("settings.company")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <div>
            <Label>{t("settings.logo")}</Label>
            <div className="flex items-start gap-4">
              <div className="w-28 h-28 rounded-md border border-border bg-cream/50 overflow-hidden flex items-center justify-center shrink-0">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon size={32} className="text-ink-muted" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} className="hidden" data-testid="settings-logo-file" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} data-testid="settings-logo-upload">
                  <Upload size={14} /> Tải logo
                </Button>
                {form.logo_url && (
                  <button type="button" onClick={() => setForm({ ...form, logo_url: "" })} className="text-xs text-red-600 hover:underline ml-2">
                    Xóa logo
                  </button>
                )}
                <div className="text-[11px] text-ink-muted">Tối đa 300KB. PNG/JPG/SVG. Recommended: vuông.</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("settings.companyName")} *</Label>
              <Input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} required data-testid="settings-shop-name" />
            </div>
            <div>
              <Label>{t("settings.taxId")}</Label>
              <Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} data-testid="settings-tax-id" />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("common.address")}</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="settings-address" />
            </div>
            <div>
              <Label>{t("common.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="settings-phone" />
            </div>
            <div>
              <Label>{t("common.email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="settings-email" />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("settings.website")}</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" data-testid="settings-website" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("settings.bankInfo")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("settings.bankName")}</Label>
              <Input
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                placeholder="VD: VietcomBank, Techcombank..."
                data-testid="settings-bank-name"
              />
            </div>
            <div>
              <Label>{t("settings.bankAccount")}</Label>
              <Input
                value={form.bank_account}
                onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                placeholder="Số tài khoản"
                data-testid="settings-bank-account"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("settings.bankAccountHolder")}</Label>
              <Input
                value={form.bank_account_holder}
                onChange={(e) => setForm({ ...form, bank_account_holder: e.target.value })}
                placeholder="Tên chủ tài khoản (in hoa)"
                data-testid="settings-bank-holder"
              />
            </div>
          </div>
          <div className="text-xs text-ink-muted">
            ℹ️ Khi đủ thông tin Ngân hàng + Số TK + Tên chủ TK, mã QR sẽ tự động xuất hiện trên bill in (nếu được bật).
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("settings.bill")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("settings.billShow")} (tích chọn để hiển thị trên bill)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {billChecks.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded border border-border hover:bg-cream/40">
                  <input
                    type="checkbox"
                    checked={!!form[c.key]}
                    onChange={(e) => setForm({ ...form, [c.key]: e.target.checked })}
                    data-testid={`settings-${c.key.replace(/_/g, '-')}`}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>{t("settings.billFooter")}</Label>
            <Textarea
              value={form.bill_footer_text}
              onChange={(e) => setForm({ ...form, bill_footer_text: e.target.value })}
              placeholder="Lời cảm ơn dưới chân bill..."
              data-testid="settings-bill-footer"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("common.language")}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button type="button" variant={lang === "vi" ? "primary" : "outline"} onClick={() => lang !== "vi" && toggleLang()}>Tiếng Việt</Button>
            <Button type="button" variant={lang === "en" ? "primary" : "outline"} onClick={() => lang !== "en" && toggleLang()}>English</Button>
          </div>
        </CardContent>
      </Card>

      {user?.role === "admin" && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-700" />
              <CardTitle className="text-red-800">Khu vực nguy hiểm</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" className="text-red-700 border-red-300 hover:bg-red-100" onClick={onResetDemo} data-testid="settings-reset-demo">
              {t("settings.resetDemoTitle")}
            </Button>
            <p className="text-xs text-red-700/80 mt-2">{t("settings.resetDemoConfirm")}</p>
          </CardContent>
        </Card>
      )}
    </form>
  );
}
