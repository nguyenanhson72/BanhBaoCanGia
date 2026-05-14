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

const EMPTY = {
  name: "",
  sku: "",
  category: "Bánh bao mặn",
  description: "",
  price: 0,
  cost: 0,
  stock: 0,
  low_stock_threshold: 10,
  unit: "cái",
  image_url: "",
  is_active: true,
  variants: [],
};

export default function Products() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    if (category) params.category = category;
    if (lowOnly) params.low_stock = true;
    const { data } = await api.get("/products", { params });
    setItems(data);
  };

  useEffect(() => { load(); }, [category, lowOnly]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku || "",
      category: p.category,
      description: p.description || "",
      price: p.price,
      cost: p.cost || 0,
      stock: p.stock || 0,
      low_stock_threshold: p.low_stock_threshold || 10,
      unit: p.unit || "cái",
      image_url: p.image_url || "",
      is_active: p.is_active !== false,
      variants: p.variants || [],
    });
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/products/${editing.product_id}`, form);
      } else {
        await api.post("/products", form);
      }
      toast({ title: t("common.saved"), variant: "success" });
      setOpen(false);
      load();
    } catch (e) {
      toast({ title: e?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`${t("common.delete")} "${p.name}"?`)) return;
    try {
      await api.delete(`/products/${p.product_id}`);
      toast({ title: t("common.deleted"), variant: "success" });
      load();
    } catch (e) {
      toast({ title: e?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const categories = Array.from(new Set(items.map((i) => i.category))).filter(Boolean);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="products-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("products.title")}</h1>
          <p className="text-sm text-ink-secondary mt-1">{items.length} {t("common.total").toLowerCase()}</p>
        </div>
        <Button onClick={openCreate} data-testid="products-new-button">
          <Plus size={16} /> {t("common.add")}
        </Button>
      </div>

      <Card>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <Label>{t("common.search")}</Label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("products.name")} className="pl-8" data-testid="products-search" />
              </div>
            </div>
            <div>
              <Label>{t("products.category")}</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} data-testid="products-category-filter">
                <option value="">{t("common.all")}</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} data-testid="products-low-stock-filter" />
                {t("products.lowStockOnly")}
              </label>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="products-grid">
        {items.length === 0 ? (
          <div className="col-span-full text-center py-12 text-ink-muted">{t("common.empty")}</div>
        ) : items.map((p) => {
          const lowStock = p.stock <= p.low_stock_threshold;
          return (
            <Card key={p.product_id} className="overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all" data-testid={`product-card-${p.product_id}`}>
              <div className="aspect-[4/3] bg-cream relative overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-muted text-xs">no image</div>
                )}
                {lowStock && (
                  <div className="absolute top-2 right-2">
                    <Badge variant={p.stock === 0 ? "cancelled" : "lowstock"}>
                      {p.stock === 0 ? t("reports.outOfStock") : t("products.lowStockOnly")}
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="space-y-2 !p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-heading font-semibold text-ink truncate">{p.name}</div>
                    <div className="text-xs text-ink-muted">{p.category}</div>
                  </div>
                  <div className="font-mono text-bamboo font-bold whitespace-nowrap">{formatVND(p.price)}</div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-muted">{t("products.stock")}: <span className={`font-medium ${lowStock ? "text-red-600" : "text-ink"}`}>{p.stock} {p.unit}</span></span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`product-edit-${p.product_id}`}>
                      <Edit size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p)} data-testid={`product-delete-${p.product_id}`}>
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("common.edit") : t("common.add")} size="lg" testId="product-modal">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("products.name")} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="product-form-name" />
            </div>
            <div>
              <Label>{t("products.category")}</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="product-form-category" />
            </div>
            <div>
              <Label>{t("common.price")} (VND) *</Label>
              <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required data-testid="product-form-price" />
            </div>
            <div>
              <Label>{t("products.cost")} (VND)</Label>
              <Input type="number" min={0} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
            </div>
            <div>
              <Label>{t("products.stock")}</Label>
              <Input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} data-testid="product-form-stock" />
            </div>
            <div>
              <Label>{t("products.lowStockThreshold")}</Label>
              <Input type="number" min={0} value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} />
            </div>
            <div>
              <Label>{t("products.unit")}</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div>
              <Label>{t("products.image")}</Label>
              <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>{t("products.description")}</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" data-testid="product-form-submit">{t("common.save")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
