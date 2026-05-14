import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Input, Label, Select, Textarea } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useI18n } from "../contexts/I18nContext";
import { useAuth } from "../contexts/AuthContext";
import { Badge } from "../components/ui/Badge";

export default function Settings() {
  const { t, lang, toggleLang } = useI18n();
  const { user } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-ink-secondary mt-1">{t("tagline")}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("settings.company")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>{t("settings.companyName")}</Label>
            <Input defaultValue="Tiệm Bánh Bao Bao" data-testid="settings-company-name" />
          </div>
          <div>
            <Label>{t("settings.description")}</Label>
            <Textarea defaultValue="Tiệm bánh bao truyền thống Việt Nam, phục vụ từ năm 2020." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("common.phone")}</Label>
              <Input defaultValue="0901234567" />
            </div>
            <div>
              <Label>{t("common.email")}</Label>
              <Input defaultValue="hello@banhbao.vn" />
            </div>
          </div>
          <div className="pt-2">
            <Button data-testid="settings-save">{t("common.save")}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("common.language")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>{t("settings.languageDefault")}</Label>
            <div className="flex gap-2">
              <Button
                variant={lang === "vi" ? "primary" : "outline"}
                onClick={() => lang !== "vi" && toggleLang()}
                data-testid="settings-lang-vi"
              >
                Tiếng Việt
              </Button>
              <Button
                variant={lang === "en" ? "primary" : "outline"}
                onClick={() => lang !== "en" && toggleLang()}
                data-testid="settings-lang-en"
              >
                English
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("settings.integrations")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { name: "Google OAuth (Emergent)", status: "connected", color: "delivered" },
              { name: "AI Assistant (Claude Sonnet 4.5)", status: "connected", color: "delivered" },
              { name: "Email (SendGrid)", status: "not connected", color: "preparing" },
              { name: "Payment (VNPay/MoMo)", status: "not connected", color: "preparing" },
            ].map((i) => (
              <div key={i.name} className="flex items-center justify-between p-3 border border-border rounded-md">
                <span className="text-sm font-medium">{i.name}</span>
                <Badge variant={i.color}>{i.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-ink-muted">{t("common.name")}</span><span className="font-medium">{user?.name}</span></div>
          <div className="flex justify-between"><span className="text-ink-muted">{t("common.email")}</span><span className="font-medium">{user?.email}</span></div>
          <div className="flex justify-between items-center"><span className="text-ink-muted">{t("users.role")}</span><Badge variant={user?.role}>{t(`users.${user?.role}`)}</Badge></div>
          <div className="flex justify-between"><span className="text-ink-muted">Auth provider</span><span className="font-medium uppercase text-xs tracking-wide">{user?.auth_provider}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
