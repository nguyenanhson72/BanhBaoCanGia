import React, { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Shield } from "lucide-react";
import api from "../lib/api";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Label } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { toast } from "../components/ui/Toast";
import { useI18n } from "../contexts/I18nContext";
import { useAuth } from "../contexts/AuthContext";
import { formatDateTime, cn } from "../lib/utils";

const ROLE_KEYS = ["admin", "manager", "coordinator", "warehouse", "accountant", "shipper", "staff"];

export default function Users() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [permSchema, setPermSchema] = useState(null);
  const [open, setOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "staff", phone: "", payment_method: "", is_active: true });
  const [useCustomPerms, setUseCustomPerms] = useState(false);
  const [customPerms, setCustomPerms] = useState([]);

  const load = async () => {
    const { data } = await api.get("/users");
    setItems(data);
  };

  useEffect(() => {
    load();
    api.get("/system/permissions").then((r) => setPermSchema(r.data)).catch(() => {});
  }, []);

  const openCreate = () => {
    setCreateMode(true);
    setEditing(null);
    setForm({ email: "", name: "", password: "", role: "staff", phone: "", payment_method: "", is_active: true });
    setUseCustomPerms(false);
    setCustomPerms([]);
    setOpen(true);
  };

  const openEdit = (u) => {
    setCreateMode(false);
    setEditing(u);
    setForm({
      email: u.email, name: u.name, password: "",
      role: u.role, phone: u.phone || "",
      payment_method: u.payment_method || "",
      is_active: u.is_active !== false,
    });
    const customs = u.permissions;
    setUseCustomPerms(Array.isArray(customs) && customs.length > 0);
    setCustomPerms(Array.isArray(customs) ? customs : (permSchema?.defaults?.[u.role] || []));
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const permsPayload = useCustomPerms ? customPerms : null;
      if (createMode) {
        await api.post("/auth/register", {
          email: form.email, name: form.name, password: form.password,
          role: form.role, phone: form.phone, permissions: permsPayload,
        });
      } else {
        const body = {
          name: form.name, role: form.role, phone: form.phone,
          payment_method: form.payment_method, is_active: form.is_active,
          permissions: permsPayload,
        };
        if (form.password) body.password = form.password;
        await api.put(`/users/${editing.user_id}`, body);
      }
      toast({ title: t("common.saved"), variant: "success" });
      setOpen(false);
      load();
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const remove = async (u) => {
    if (u.user_id === user?.user_id) return;
    if (!window.confirm(`${t("common.delete")} "${u.name}"?`)) return;
    try {
      await api.delete(`/users/${u.user_id}`);
      toast({ title: t("common.deleted"), variant: "success" });
      load();
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const togglePerm = (key) => {
    setCustomPerms((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  };

  // Group permissions by category
  const grouped = {};
  (permSchema?.keys || []).forEach((k) => {
    const cat = k.split(".")[0];
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(k);
  });

  // When role changes & not using custom, reset custom perms preview
  useEffect(() => {
    if (!useCustomPerms && permSchema) {
      setCustomPerms(permSchema.defaults[form.role] || []);
    }
    // eslint-disable-next-line
  }, [form.role, useCustomPerms]);

  const CAT_LABELS = {
    orders: "Đơn hàng", products: "Sản phẩm", materials: "NVL",
    stock: "Kho", customers: "Khách hàng", suppliers: "NCC",
    debts: "Công nợ", delivery: "Giao hàng", reports: "Báo cáo",
    users: "Nhân viên", settings: "Cài đặt",
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="users-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("users.title")}</h1>
          <p className="text-sm text-ink-secondary mt-1">{items.length} {t("common.total").toLowerCase()}</p>
        </div>
        {user?.role === "admin" && (
          <Button onClick={openCreate} data-testid="users-new-button">
            <Plus size={16} /> {t("common.add")}
          </Button>
        )}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
              <tr>
                <th className="text-left py-3 px-4">{t("common.name")}</th>
                <th className="text-left py-3 px-4">{t("common.email")}</th>
                <th className="text-center py-3 px-4">{t("users.role")}</th>
                <th className="text-center py-3 px-4">{t("common.status")}</th>
                <th className="text-left py-3 px-4">Auth</th>
                <th className="text-left py-3 px-4">Tạo lúc</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody data-testid="users-table-body">
              {items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-ink-muted">{t("common.empty")}</td></tr>
              ) : items.map((u) => (
                <tr key={u.user_id} className="border-t border-border hover:bg-cream/30" data-testid={`user-row-${u.user_id}`}>
                  <td className="py-3 px-4 font-medium">{u.name}</td>
                  <td className="py-3 px-4 text-xs">{u.email}</td>
                  <td className="py-3 px-4 text-center"><Badge variant={u.role}>{t(`users.${u.role}`)}</Badge></td>
                  <td className="py-3 px-4 text-center">
                    {u.is_active !== false ? <Badge variant="delivered">{t("users.active")}</Badge> : <Badge variant="cancelled">{t("users.inactive")}</Badge>}
                  </td>
                  <td className="py-3 px-4 text-xs uppercase tracking-wide text-ink-muted">{u.auth_provider}</td>
                  <td className="py-3 px-4 text-xs text-ink-muted">{formatDateTime(u.created_at)}</td>
                  <td className="py-3 px-4 text-right">
                    {user?.role === "admin" && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)} data-testid={`user-edit-${u.user_id}`}>
                          <Edit size={14} />
                        </Button>
                        {u.user_id !== user?.user_id && (
                          <Button variant="ghost" size="icon" onClick={() => remove(u)} data-testid={`user-delete-${u.user_id}`}>
                            <Trash2 size={14} className="text-red-500" />
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={createMode ? t("common.add") : t("common.edit")} size="xl" testId="user-modal">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("common.name")} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="user-form-name" />
            </div>
            <div>
              <Label>{t("common.email")} *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={!createMode} data-testid="user-form-email" />
            </div>
            <div>
              <Label>{createMode ? t("auth.password") : t("users.newPassword")}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={createMode} data-testid="user-form-password" />
            </div>
            <div>
              <Label>{t("common.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>{t("users.role")}</Label>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} data-testid="user-form-role">
                {ROLE_KEYS.map((r) => <option key={r} value={r}>{t(`users.${r}`)}</option>)}
              </Select>
            </div>
            <div>
              <Label>{t("users.paymentMethod")}</Label>
              <Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="Tiền mặt / Chuyển khoản" />
            </div>
            {!createMode && (
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} data-testid="user-form-active" />
                  {t("users.active")}
                </label>
              </div>
            )}
          </div>

          {permSchema && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-bamboo" />
                  <h3 className="font-heading font-semibold text-sm">{t("users.permissions")}</h3>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomPerms}
                    onChange={(e) => setUseCustomPerms(e.target.checked)}
                    data-testid="user-use-custom-perms"
                  />
                  {t("users.customPermissions")}
                </label>
              </div>
              {!useCustomPerms && (
                <div className="text-xs text-ink-muted bg-cream/40 p-3 rounded">
                  {t("users.useDefault")} cho <Badge variant={form.role}>{t(`users.${form.role}`)}</Badge>:
                  <span className="ml-2 font-mono">{(permSchema.defaults[form.role] || []).length} quyền</span>
                </div>
              )}
              {useCustomPerms && (
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {Object.entries(grouped).map(([cat, keys]) => (
                    <div key={cat} className="border border-border rounded-md p-3">
                      <div className="text-xs uppercase tracking-wide font-semibold text-ink-secondary mb-2">{CAT_LABELS[cat] || cat}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {keys.map((k) => (
                          <label key={k} className={cn("flex items-center gap-1.5 text-xs cursor-pointer p-1.5 rounded hover:bg-cream/60")}>
                            <input
                              type="checkbox"
                              checked={customPerms.includes(k)}
                              onChange={() => togglePerm(k)}
                              data-testid={`perm-${k}`}
                            />
                            <span className="font-mono text-[11px]">{k.split(".")[1]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" data-testid="user-form-submit">{t("common.save")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
