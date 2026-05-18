import React, { useEffect, useState, useRef } from "react";
import { Plus, Search, Edit, Trash2, Upload, Image as ImageIcon, PackagePlus } from "lucide-react";
import api from "../lib/api";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Label, Textarea } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { toast } from "../components/ui/Toast";
import { useI18n } from "../contexts/I18nContext";
import { formatVND, formatDate } from "../lib/utils";

const EMPTY = {
  name: "",
  sku: "",
  category: "Bánh bao",
  description: "",
  price: 0,
  wholesale_price: 0,
  cost: 0,
  stock: 0,
  low_stock_threshold: 10,
  unit: "cái",
  image_url: "",
  is_active: true,
  variants: [],
  expiration_days: 3,
};

const EMPTY_STOCK = {
  kind: "product",
  target_id: "",
  quantity: 0,
  unit_price: 0,
  supplier_id: "",
  supplier_name: "",
  production_date: new Date().toISOString().slice(0, 10),
  expiration_date: "",
  batch_code: "",
  notes: "",
};

const MAX_IMAGE_BYTES = 500 * 1024; // 500 KB

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Products() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [stockOpen, setStockOpen] = useState(false);
  const [stockForm, setStockForm] = useState(EMPTY_STOCK);
  const [suppliers, setSuppliers] = useState([]);
  const fileInputRef = useRef(null);

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    if (category) params.category = category;
    if (lowOnly) params.low_stock = true;
    const { data } = await api.get("/products", { params });
    setItems(data);
  };

  useEffect(() => {
    load();
    api.get("/suppliers").then((r) => setSuppliers(r.data)).catch(() => {});
    /* eslint-disable-next-line */
  }, [category, lowOnly]);

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

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Vui lòng chọn file hình ảnh", variant: "error" });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        title: "Ảnh quá lớn",
        description: `Tối đa ${Math.round(MAX_IMAGE_BYTES / 1024)} KB. Vui lòng nén ảnh trước.`,
        variant: "error",
      });
      return;
    }
    try {
      const b64 = await fileToBase64(file);
      setForm((prev) => ({ ...prev, image_url: b64 }));
      toast({ title: "Đã tải ảnh", variant: "success" });
    } catch {
      toast({ title: "Không đọc được file", variant: "error" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`${t("common.delete")} "${p.name}"?`)) return;
    try {
      await api.delete(`/products/${p.product_id}`);
      toast({ title: t("common.deleted"), variant: "success" });
      load();
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
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
          const negative = p.stock < 0;
          return (
            <Card key={p.product_id} className="overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all" data-testid={`product-card-${p.product_id}`}>
              <div className="aspect-[4/3] bg-cream relative overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-muted text-xs">no image</div>
                )}
                {(lowStock || negative) && (
                  <div className="absolute top-2 right-2">
                    <Badge variant={negative ? "cancelled" : p.stock === 0 ? "cancelled" : "lowstock"}>
                      {negative ? `Âm ${p.stock}` : p.stock === 0 ? t("reports.outOfStock") : t("products.lowStockOnly")}
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
                  <span className="text-ink-muted">
                    {t("products.stock")}:{" "}
                    <span className={`font-medium ${negative ? "text-red-700" : lowStock ? "text-red-600" : "text-ink"}`}>
                      {p.stock} {p.unit}
                    </span>
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openStockIn(p)} data-testid={`product-stockin-${p.product_id}`} title="Nhập kho">
                      <PackagePlus size={14} className="text-bamboo" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`product-edit-${p.product_id}`}>
                      <Edit size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p)} data-testid={`product-delete-${p.product_id}`}>
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </div>
                </div>
                {p.latest_expiration_date && (
                  <div className="text-[11px] text-ink-muted mt-1 flex items-center gap-1">
                    HSD lô gần nhất: <span className="font-medium text-bamboo">{formatDate(p.latest_expiration_date)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("common.edit") : t("common.add")} size="lg" testId="product-modal">
        <form onSubmit={submit} className="space-y-4">
          {/* Image upload area */}
          <div>
            <Label>{t("products.image")}</Label>
            <div className="flex items-start gap-4">
              <div className="w-28 h-28 rounded-md border border-border bg-cream/50 overflow-hidden flex items-center justify-center shrink-0">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={32} className="text-ink-muted" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickFile}
                  className="hidden"
                  data-testid="product-form-image-file"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="product-form-upload-button">
                  <Upload size={14} /> Tải ảnh từ máy
                </Button>
                <div className="text-xs text-ink-muted">Hoặc dán URL ảnh:</div>
                <Input
                  value={form.image_url?.startsWith("data:") ? "" : form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://..."
                  data-testid="product-form-image-url"
                />
                {form.image_url && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, image_url: "" })}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Xóa ảnh
                  </button>
                )}
                <div className="text-[11px] text-ink-muted">Tối đa 500KB. JPG/PNG/WebP.</div>
              </div>
            </div>
          </div>

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
              <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} data-testid="product-form-stock" />
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
              <Label>HSD mặc định (ngày)</Label>
              <Input type="number" min={1} value={form.expiration_days} onChange={(e) => setForm({ ...form, expiration_days: Number(e.target.value) })} placeholder="3" data-testid="product-form-expiration-days" />
            </div>
            <div>
              <Label>Giá sỉ (VND)</Label>
              <Input type="number" min={0} value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: Number(e.target.value) })} />
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

      {/* Stock-in for product (nhập kho ngày mới) */}
      <Modal open={stockOpen} onClose={() => setStockOpen(false)} title={`Nhập kho sản phẩm: ${stockForm.target_name || ""}`} size="lg" testId="product-stockin-modal">
        <form onSubmit={submitStockIn} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Số lượng *</Label>
              <Input type="number" min={1} required value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: Number(e.target.value) })} data-testid="product-stockin-qty" />
            </div>
            <div>
              <Label>Đơn giá (nếu có)</Label>
              <Input type="number" min={0} value={stockForm.unit_price} onChange={(e) => setStockForm({ ...stockForm, unit_price: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Ngày sản xuất</Label>
              <Input type="date" value={stockForm.production_date} onChange={(e) => setStockForm({ ...stockForm, production_date: e.target.value })} data-testid="product-stockin-prod-date" />
            </div>
            <div>
              <Label>HSD</Label>
              <Input type="date" value={stockForm.expiration_date} onChange={(e) => setStockForm({ ...stockForm, expiration_date: e.target.value })} placeholder="Tự tính" data-testid="product-stockin-exp-date" />
            </div>
            <div className="col-span-2">
              <Label>Nhà cung cấp (tùy chọn)</Label>
              <Select value={stockForm.supplier_id} onChange={(e) => {
                const s = suppliers.find((x) => x.supplier_id === e.target.value);
                setStockForm({ ...stockForm, supplier_id: e.target.value, supplier_name: s?.name || "" });
              }} data-testid="product-stockin-supplier">
                <option value="">— Chọn NCC —</option>
                {suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>)}
              </Select>
              {stockForm.supplier_id && stockForm.unit_price > 0 && (
                <div className="text-xs text-amber-700 mt-1">💡 Sẽ tự ghi nhận <strong>{formatVND(stockForm.unit_price * stockForm.quantity)}</strong> vào công nợ NCC</div>
              )}
            </div>
            <div className="col-span-2">
              <Label>{t("common.notes")}</Label>
              <Textarea value={stockForm.notes} onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setStockOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" data-testid="product-stockin-submit">Nhập kho</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
