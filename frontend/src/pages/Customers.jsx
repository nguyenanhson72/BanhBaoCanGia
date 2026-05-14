import React, { useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import api from "../lib/api";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Label, Textarea } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { toast } from "../components/ui/Toast";
import { useI18n } from "../contexts/I18nContext";
import { formatVND } from "../lib/utils";

const EMPTY = { name: "", phone: "", email: "", address: "", group: "new", notes: "" };

export default function Customers() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    if (group) params.group = group;
    const { data } = await api.get("/customers", { params });
    setItems(data);
  };

  useEffect(() => { load(); }, [group]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone || "", email: c.email || "", address: c.address || "", group: c.group || "new", notes: c.notes || "" });
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/customers/${editing.customer_id}`, form);
      else await api.post("/customers", form);
      toast({ title: t("common.saved"), variant: "success" });
      setOpen(false);
      load();
    } catch (e) {
      toast({ title: e?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`${t("common.delete")} "${c.name}"?`)) return;
    try {
      await api.delete(`/customers/${c.customer_id}`);
      toast({ title: t("common.deleted"), variant: "success" });
      load();
    } catch (e) {
      toast({ title: e?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="customers-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("customers.title")}</h1>
          <p className="text-sm text-ink-secondary mt-1">{items.length} {t("common.total").toLowerCase()}</p>
        </div>
        <Button onClick={openCreate} data-testid="customers-new-button">
          <Plus size={16} /> {t("common.add")}
        </Button>
      </div>

      <Card>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label>{t("common.search")}</Label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${t("common.name")} / ${t("common.phone")}`} className="pl-8" data-testid="customers-search" />
              </div>
            </div>
            <div>
              <Label>{t("customers.group")}</Label>
              <Select value={group} onChange={(e) => setGroup(e.target.value)} data-testid="customers-group-filter">
                <option value="">{t("common.all")}</option>
                <option value="vip">{t("customers.vip")}</option>
                <option value="regular">{t("customers.regular")}</option>
                <option value="new">{t("customers.new")}</option>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
              <tr>
                <th className="text-left py-3 px-4">{t("common.name")}</th>
                <th className="text-left py-3 px-4">{t("common.phone")}</th>
                <th className="text-left py-3 px-4">{t("common.email")}</th>
                <th className="text-center py-3 px-4">{t("customers.group")}</th>
                <th className="text-right py-3 px-4">{t("customers.totalOrders")}</th>
                <th className="text-right py-3 px-4">{t("customers.totalSpent")}</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody data-testid="customers-table-body">
              {items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-ink-muted">{t("common.empty")}</td></tr>
              ) : items.map((c) => (
                <tr key={c.customer_id} className="border-t border-border hover:bg-cream/30" data-testid={`customer-row-${c.customer_id}`}>
                  <td className="py-3 px-4 font-medium">{c.name}</td>
                  <td className="py-3 px-4">{c.phone}</td>
                  <td className="py-3 px-4 text-ink-muted text-xs">{c.email}</td>
                  <td className="py-3 px-4 text-center"><Badge variant={c.group}>{t(`customers.${c.group}`)}</Badge></td>
                  <td className="py-3 px-4 text-right">{c.total_orders || 0}</td>
                  <td className="py-3 px-4 text-right font-mono text-xs">{formatVND(c.total_spent || 0)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} data-testid={`customer-edit-${c.customer_id}`}>
                        <Edit size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(c)} data-testid={`customer-delete-${c.customer_id}`}>
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("common.edit") : t("common.add")} testId="customer-modal">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>{t("common.name")} *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="customer-form-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("common.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="customer-form-phone" />
            </div>
            <div>
              <Label>{t("common.email")}</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>{t("common.address")}</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>{t("customers.group")}</Label>
            <Select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}>
              <option value="new">{t("customers.new")}</option>
              <option value="regular">{t("customers.regular")}</option>
              <option value="vip">{t("customers.vip")}</option>
            </Select>
          </div>
          <div>
            <Label>{t("common.notes")}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" data-testid="customer-form-submit">{t("common.save")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
