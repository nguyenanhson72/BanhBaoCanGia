import React, { useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2, Star } from "lucide-react";
import api from "../lib/api";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Label, Textarea } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { toast } from "../components/ui/Toast";
import { useI18n } from "../contexts/I18nContext";

const EMPTY = { name: "", code: "", group: "default", phone: "", email: "", address: "", district: "", city: "", tax_id: "", rating: 5, notes: "" };

export default function Suppliers() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    const { data } = await api.get("/suppliers", { params });
    setItems(data);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ ...EMPTY, ...s });
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/suppliers/${editing.supplier_id}`, form);
      else await api.post("/suppliers", form);
      toast({ title: t("common.saved"), variant: "success" });
      setOpen(false);
      load();
    } catch (e) {
      toast({ title: e?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`${t("common.delete")} "${s.name}"?`)) return;
    try {
      await api.delete(`/suppliers/${s.supplier_id}`);
      toast({ title: t("common.deleted"), variant: "success" });
      load();
    } catch (e) {
      toast({ title: e?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="suppliers-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("customers.titleSupplier")}</h1>
          <p className="text-sm text-ink-secondary mt-1">{items.length} {t("common.total").toLowerCase()}</p>
        </div>
        <Button onClick={openCreate} data-testid="suppliers-new-button">
          <Plus size={16} /> {t("common.add")}
        </Button>
      </div>

      <Card>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); load(); }}>
            <Label>{t("common.search")}</Label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${t("common.name")} / ${t("common.phone")}`} className="pl-8 max-w-md" data-testid="suppliers-search" />
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 ? (
          <div className="col-span-full text-center py-12 text-ink-muted">{t("common.empty")}</div>
        ) : items.map((s) => (
          <Card key={s.supplier_id} className="hover:-translate-y-0.5 hover:shadow-md transition-all" data-testid={`supplier-card-${s.supplier_id}`}>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-heading font-semibold text-ink truncate">{s.name}</div>
                  <div className="text-xs text-ink-muted">{s.email}</div>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={12} className={i < s.rating ? "fill-amber-400 text-amber-400" : "text-border"} />
                  ))}
                </div>
              </div>
              <div className="text-sm space-y-1">
                <div><span className="text-ink-muted">{t("common.phone")}:</span> {s.phone || "—"}</div>
                <div className="text-xs text-ink-muted">{s.address}</div>
              </div>
              {s.notes && <div className="text-xs text-ink-secondary bg-cream/40 p-2 rounded">{s.notes}</div>}
              <div className="flex justify-end gap-1 pt-2 border-t border-border">
                <Button variant="ghost" size="icon" onClick={() => openEdit(s)} data-testid={`supplier-edit-${s.supplier_id}`}>
                  <Edit size={14} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(s)} data-testid={`supplier-delete-${s.supplier_id}`}>
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("common.edit") : t("common.add")} testId="supplier-modal">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>{t("common.name")} *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="supplier-form-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mã NCC</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Tự sinh" />
            </div>
            <div>
              <Label>Nhóm</Label>
              <Input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="default" />
            </div>
            <div>
              <Label>{t("common.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>{t("common.email")}</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{t("common.district")}</Label>
              <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="VD: Quận Tân Bình" />
            </div>
            <div>
              <Label>{t("common.city")}</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="VD: TP.HCM" />
            </div>
          </div>
          <div>
            <Label>{t("common.address")}</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>MST</Label>
            <Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
          </div>
          <div>
            <Label>{t("customers.rating")} (1-5)</Label>
            <Input type="number" min={1} max={5} value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} />
          </div>
          <div>
            <Label>{t("common.notes")}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" data-testid="supplier-form-submit">{t("common.save")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
