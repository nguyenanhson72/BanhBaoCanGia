import React, { useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2, PackagePlus, Wheat } from "lucide-react";
import api from "../lib/api";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Label, Select, Textarea } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { toast } from "../components/ui/Toast";
import { useI18n } from "../contexts/I18nContext";
import { formatVND, formatDate } from "../lib/utils";

const EMPTY = {
  name: "", code: "", unit: "kg", stock: 0, cost: 0,
  low_stock_threshold: 0, expiration_days: 30, notes: "", is_active: true,
};

const EMPTY_STOCK = {
  kind: "material", target_id: "", quantity: 0, unit_price: 0,
  supplier_id: "", supplier_name: "", production_date: "",
  expiration_date: "", batch_code: "", notes: "",
};

export default function Materials() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const [stockOpen, setStockOpen] = useState(false);
  const [stockForm, setStockForm] = useState(EMPTY_STOCK);
  const [suppliers, setSuppliers] = useState([]);
  const [movements, setMovements] = useState([]);

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    const { data } = await api.get("/materials", { params });
    setItems(data);
  };

  const loadMovements = async (materialId) => {
    const { data } = await api.get("/stock/movements", { params: { kind: "material", target_id: materialId } });
    setMovements(data);
  };

  useEffect(() => {
    load();
    api.get("/suppliers").then((r) => setSuppliers(r.data)).catch(() => {});
  }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (m) => {
    setEditing(m);
    setForm({ ...EMPTY, ...m });
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/materials/${editing.material_id}`, form);
      else await api.post("/materials", form);
      toast({ title: t("common.saved"), variant: "success" });
      setOpen(false);
      load();
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`${t("common.delete")} "${m.name}"?`)) return;
    try {
      await api.delete(`/materials/${m.material_id}`);
      toast({ title: t("common.deleted"), variant: "success" });
      load();
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const openStockIn = (m) => {
    setStockForm({
      ...EMPTY_STOCK,
      kind: "material",
      target_id: m.material_id,
      target_name: m.name,
      unit: m.unit,
    });
    setStockOpen(true);
    loadMovements(m.material_id);
  };

  const submitStockIn = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...stockForm };
      if (!payload.production_date) delete payload.production_date;
      if (!payload.expiration_date) delete payload.expiration_date;
      if (!payload.supplier_id) delete payload.supplier_id;
      await api.post("/stock/in", payload);
      toast({ title: t("common.saved"), variant: "success" });
      setStockOpen(false);
      load();
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="materials-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <Wheat size={28} className="text-bamboo" /> {t("materials.title")}
          </h1>
          <p className="text-sm text-ink-secondary mt-1">{items.length} NVL</p>
        </div>
        <Button onClick={openCreate} data-testid="materials-new-button">
          <Plus size={16} /> {t("materials.new")}
        </Button>
      </div>

      <Card>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); load(); }}>
            <Label>{t("common.search")}</Label>
            <div className="relative max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên / Mã NVL" className="pl-8" data-testid="materials-search" />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
              <tr>
                <th className="text-left py-3 px-4">Mã</th>
                <th className="text-left py-3 px-4">Tên NVL</th>
                <th className="text-right py-3 px-4">Tồn</th>
                <th className="text-right py-3 px-4">Giá vốn</th>
                <th className="text-right py-3 px-4">Ngưỡng</th>
                <th className="text-center py-3 px-4">{t("common.status")}</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody data-testid="materials-table-body">
              {items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-ink-muted">{t("common.empty")}</td></tr>
              ) : items.map((m) => {
                const low = m.stock <= m.low_stock_threshold;
                return (
                  <tr key={m.material_id} className="border-t border-border hover:bg-cream/30" data-testid={`material-row-${m.material_id}`}>
                    <td className="py-3 px-4 font-mono text-xs">{m.code}</td>
                    <td className="py-3 px-4 font-medium">{m.name}</td>
                    <td className={`py-3 px-4 text-right ${low ? "text-red-700 font-bold" : ""}`}>{m.stock} {m.unit}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs">{formatVND(m.cost)}</td>
                    <td className="py-3 px-4 text-right text-xs">{m.low_stock_threshold} {m.unit}</td>
                    <td className="py-3 px-4 text-center">
                      {low ? <Badge variant="lowstock">Tồn thấp</Badge> : <Badge variant="delivered">OK</Badge>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openStockIn(m)} data-testid={`material-stockin-${m.material_id}`} title="Nhập kho">
                          <PackagePlus size={14} className="text-bamboo" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)} data-testid={`material-edit-${m.material_id}`}>
                          <Edit size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(m)} data-testid={`material-delete-${m.material_id}`}>
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create/Edit material */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("common.edit") : t("materials.new")} size="md" testId="material-modal">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("materials.name")} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="material-form-name" />
            </div>
            <div>
              <Label>{t("materials.code")}</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Tự sinh" />
            </div>
            <div>
              <Label>Đơn vị</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, lít, cái..." />
            </div>
            <div>
              <Label>Tồn ban đầu</Label>
              <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Giá vốn (/đơn vị)</Label>
              <Input type="number" min={0} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Ngưỡng cảnh báo</Label>
              <Input type="number" min={0} value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} />
            </div>
            <div>
              <Label>{t("materials.expirationDays")}</Label>
              <Input type="number" min={0} value={form.expiration_days} onChange={(e) => setForm({ ...form, expiration_days: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>{t("common.notes")}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" data-testid="material-form-submit">{t("common.save")}</Button>
          </div>
        </form>
      </Modal>

      {/* Stock in dialog */}
      <Modal open={stockOpen} onClose={() => setStockOpen(false)} title={`Nhập kho: ${stockForm.target_name || ""}`} size="lg" testId="stock-in-modal">
        <form onSubmit={submitStockIn} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("common.quantity")} *</Label>
              <Input type="number" min={0} step="any" required value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: Number(e.target.value) })} data-testid="stock-in-qty" />
            </div>
            <div>
              <Label>Đơn giá</Label>
              <Input type="number" min={0} value={stockForm.unit_price} onChange={(e) => setStockForm({ ...stockForm, unit_price: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Nhà cung cấp</Label>
              <Select value={stockForm.supplier_id} onChange={(e) => {
                const s = suppliers.find((x) => x.supplier_id === e.target.value);
                setStockForm({ ...stockForm, supplier_id: e.target.value, supplier_name: s?.name || "" });
              }}>
                <option value="">— Chọn NCC —</option>
                {suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>{t("materials.batch")}</Label>
              <Input value={stockForm.batch_code} onChange={(e) => setStockForm({ ...stockForm, batch_code: e.target.value })} placeholder="Tự sinh" />
            </div>
            <div>
              <Label>{t("materials.productionDate")}</Label>
              <Input type="date" value={stockForm.production_date} onChange={(e) => setStockForm({ ...stockForm, production_date: e.target.value })} />
            </div>
            <div>
              <Label>{t("materials.expirationDate")}</Label>
              <Input type="date" value={stockForm.expiration_date} onChange={(e) => setStockForm({ ...stockForm, expiration_date: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>{t("common.notes")}</Label>
            <Textarea value={stockForm.notes} onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })} />
          </div>
          <div className="text-sm text-bamboo font-bold text-right">
            Thành tiền: {formatVND(stockForm.unit_price * stockForm.quantity)}
          </div>

          {movements.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="text-xs font-medium text-ink-muted mb-2">5 lần nhập gần đây:</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {movements.slice(0, 5).map((m) => (
                  <div key={m.movement_id} className="text-xs flex justify-between bg-cream/40 px-2 py-1 rounded">
                    <span>{formatDate(m.created_at)} · {m.batch_code} · {m.quantity > 0 ? "+" : ""}{m.quantity}</span>
                    <span className="font-mono">{m.expiration_date ? `HSD ${formatDate(m.expiration_date)}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setStockOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" data-testid="stock-in-submit">{t("stock.in")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
