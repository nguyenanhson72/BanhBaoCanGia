import React, { useEffect, useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import api from "../lib/api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Label } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { toast } from "../components/ui/Toast";
import { useI18n } from "../contexts/I18nContext";
import { useAuth } from "../contexts/AuthContext";
import { formatDateTime } from "../lib/utils";

export default function Users() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "staff", phone: "", payment_method: "" });

  const load = async () => {
    const { data } = await api.get("/users");
    setItems(data);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setCreateMode(true);
    setEditing(null);
    setForm({ email: "", name: "", password: "", role: "staff", phone: "", payment_method: "" });
    setOpen(true);
  };

  const openEdit = (u) => {
    setCreateMode(false);
    setEditing(u);
    setForm({
      email: u.email,
      name: u.name,
      password: "",
      role: u.role,
      phone: u.phone || "",
      payment_method: u.payment_method || "",
    });
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (createMode) {
        await api.post("/auth/register", { email: form.email, name: form.name, password: form.password, role: form.role });
      } else {
        const body = { name: form.name, role: form.role, phone: form.phone, payment_method: form.payment_method };
        if (form.password) body.password = form.password;
        await api.put(`/users/${editing.user_id}`, body);
      }
      toast({ title: t("common.saved"), variant: "success" });
      setOpen(false);
      load();
    } catch (e) {
      toast({ title: e?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const remove = async (u) => {
    if (u.user_id === user?.user_id) return;
    if (!window.confirm(`${t("common.delete")} "${u.name}"?`)) return;
    try {
      await api.delete(`/users/${u.user_id}`);
      toast({ title: t("common.deleted"), variant: "success" });
      load();
    } catch (e) {
      toast({ title: e?.response?.data?.detail || t("common.error"), variant: "error" });
    }
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
                <th className="text-left py-3 px-4">Auth</th>
                <th className="text-left py-3 px-4">Created</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody data-testid="users-table-body">
              {items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-ink-muted">{t("common.empty")}</td></tr>
              ) : items.map((u) => (
                <tr key={u.user_id} className="border-t border-border hover:bg-cream/30" data-testid={`user-row-${u.user_id}`}>
                  <td className="py-3 px-4 font-medium">{u.name}</td>
                  <td className="py-3 px-4 text-xs">{u.email}</td>
                  <td className="py-3 px-4 text-center"><Badge variant={u.role}>{t(`users.${u.role}`)}</Badge></td>
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

      <Modal open={open} onClose={() => setOpen(false)} title={createMode ? t("common.add") : t("common.edit")} testId="user-modal">
        <form onSubmit={submit} className="space-y-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("users.role")}</Label>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} data-testid="user-form-role">
                <option value="staff">{t("users.staff")}</option>
                <option value="manager">{t("users.manager")}</option>
                <option value="admin">{t("users.admin")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("common.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>{t("users.paymentMethod")}</Label>
            <Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder={`${t("payment.cash")} / ${t("payment.transfer")}`} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" data-testid="user-form-submit">{t("common.save")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
