import React, { useEffect, useState } from "react";
import { Factory, Plus, Calendar, Brain, Trash2, Sparkles, ArrowLeftRight, BarChart2, Download } from "lucide-react";
import api from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Label, Select, Textarea } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { toast } from "../components/ui/Toast";
import { useI18n } from "../contexts/I18nContext";
import { formatDate, formatDateTime, cn, formatVND } from "../lib/utils";

const SHIFTS = [
  { id: "morning", label: "Sáng (6h-11h)" },
  { id: "afternoon", label: "Chiều (11h-17h)" },
  { id: "evening", label: "Tối (17h-22h)" },
  { id: "night", label: "Đêm" },
];

export default function Production() {
  const { t } = useI18n();
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("xnt");
  // Stock movements tab state
  const [movements, setMovements] = useState([]);
  const [movKind, setMovKind] = useState("");
  const [movDateFrom, setMovDateFrom] = useState("");
  const [movDateTo, setMovDateTo] = useState("");
  // XNT report state
  const [xntKind, setXntKind] = useState("product");
  const [xntDateFrom, setXntDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [xntDateTo, setXntDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [xnt, setXnt] = useState(null);
  const [form, setForm] = useState({
    product_id: "",
    quantity: 1,
    shift: "morning",
    production_date: new Date().toISOString().slice(0, 10),
    expiration_date: "",
    batch_code: "",
    materials_used: [],
    notes: "",
  });

  const load = async () => {
    const [b, p, m] = await Promise.all([
      api.get("/production"),
      api.get("/products"),
      api.get("/materials").catch(() => ({ data: [] })),
    ]);
    setBatches(b.data);
    setProducts(p.data);
    setMaterials(m.data);
  };

  const loadForecast = async () => {
    try {
      const { data } = await api.get("/production/forecast?days_ahead=1");
      setForecast(data);
    } catch {}
  };

  const loadMovements = async () => {
    const params = new URLSearchParams();
    if (movKind) params.set("kind", movKind);
    if (movDateFrom) params.set("date_from", movDateFrom);
    if (movDateTo) params.set("date_to", movDateTo);
    const { data } = await api.get(`/stock/movements?${params.toString()}`);
    setMovements(data);
  };

  const loadXNT = async () => {
    const params = new URLSearchParams({ kind: xntKind });
    if (xntDateFrom) params.set("date_from", xntDateFrom);
    if (xntDateTo) params.set("date_to", xntDateTo);
    const { data } = await api.get(`/inventory/xnt?${params.toString()}`);
    setXnt(data);
  };

  const exportXntXlsx = () => {
    if (!xnt || !xnt.items?.length) return;
    // Build CSV (Excel-compatible) with BOM for VN diacritics
    const rows = [
      ["Tên", "ĐVT", "Tồn đầu", "Nhập", "Xuất", "Tồn cuối", "Tồn hiện tại"],
      ...xnt.items.map((r) => [r.name, r.unit, r.opening_stock, r.total_in, r.total_out, r.ending_stock, r.current_stock]),
      ["TỔNG", "", xnt.totals.total_opening, xnt.totals.total_in, xnt.totals.total_out, xnt.totals.total_ending, ""],
    ];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xnt_${xntKind}_${xntDateFrom}_${xntDateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => { load(); loadForecast(); }, []);
  useEffect(() => { if (tab === "stockin") loadMovements(); /* eslint-disable-next-line */ }, [tab, movKind, movDateFrom, movDateTo]);
  useEffect(() => { if (tab === "xnt") loadXNT(); /* eslint-disable-next-line */ }, [tab, xntKind, xntDateFrom, xntDateTo]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (!payload.expiration_date) delete payload.expiration_date;
      if (!payload.batch_code) delete payload.batch_code;
      payload.materials_used = (payload.materials_used || []).filter((m) => m.material_id);
      await api.post("/production", payload);
      toast({ title: "Đã tạo lô sản xuất", variant: "success" });
      setOpen(false);
      load();
      loadForecast();
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const remove = async (b) => {
    if (!window.confirm(`${t("common.delete")} lô "${b.batch_code}"? Tồn kho sẽ được hoàn lại.`)) return;
    try {
      await api.delete(`/production/${b.batch_id}`);
      toast({ title: t("common.deleted"), variant: "success" });
      load();
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const addMaterial = () => {
    setForm((p) => ({ ...p, materials_used: [...(p.materials_used || []), { material_id: "", quantity: 0 }] }));
  };

  const updateMaterial = (idx, field, value) => {
    setForm((p) => {
      const next = [...(p.materials_used || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, materials_used: next };
    });
  };

  const removeMaterial = (idx) => {
    setForm((p) => ({ ...p, materials_used: (p.materials_used || []).filter((_, i) => i !== idx) }));
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="production-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
            <Factory size={28} className="text-bamboo" /> Kho hàng hóa
          </h1>
          <p className="text-sm text-ink-secondary mt-1">Nhập kho · Xuất nhập tồn · Sản xuất theo ca · AI gợi ý</p>
        </div>
        {tab === "batches" && (
          <Button onClick={() => setOpen(true)} data-testid="production-new-button">
            <Plus size={16} /> Lô SX mới
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <button onClick={() => setTab("xnt")} className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap", tab === "xnt" ? "border-bamboo text-bamboo" : "border-transparent text-ink-muted")} data-testid="warehouse-tab-xnt">
          <BarChart2 size={14} /> Xuất Nhập Tồn
        </button>
        <button onClick={() => setTab("stockin")} className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap", tab === "stockin" ? "border-bamboo text-bamboo" : "border-transparent text-ink-muted")} data-testid="warehouse-tab-stockin">
          <ArrowLeftRight size={14} /> Lịch sử nhập/xuất
        </button>
        <button onClick={() => setTab("batches")} className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap", tab === "batches" ? "border-bamboo text-bamboo" : "border-transparent text-ink-muted")} data-testid="production-tab-batches">
          <Calendar size={14} /> Sản xuất theo ca
        </button>
        <button onClick={() => setTab("forecast")} className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap", tab === "forecast" ? "border-bamboo text-bamboo" : "border-transparent text-ink-muted")} data-testid="production-tab-forecast">
          <Brain size={14} /> AI Gợi ý
        </button>
      </div>

      {tab === "xnt" && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><BarChart2 size={16} className="text-bamboo" /> Báo cáo Xuất Nhập Tồn</CardTitle>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label>Loại</Label>
                  <Select value={xntKind} onChange={(e) => setXntKind(e.target.value)} data-testid="xnt-kind">
                    <option value="product">Sản phẩm</option>
                    <option value="material">Nguyên vật liệu</option>
                  </Select>
                </div>
                <div>
                  <Label>Từ ngày</Label>
                  <Input type="date" value={xntDateFrom} onChange={(e) => setXntDateFrom(e.target.value)} data-testid="xnt-date-from" />
                </div>
                <div>
                  <Label>Đến ngày</Label>
                  <Input type="date" value={xntDateTo} onChange={(e) => setXntDateTo(e.target.value)} data-testid="xnt-date-to" />
                </div>
                <Button variant="outline" size="sm" onClick={exportXntXlsx} data-testid="xnt-export-csv"><Download size={14} /> CSV</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="!p-0">
            {!xnt ? (
              <div className="text-center py-8 text-ink-muted text-sm">Đang tải...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
                    <tr>
                      <th className="text-left py-3 px-4">Tên</th>
                      <th className="text-center py-3 px-4">ĐVT</th>
                      <th className="text-right py-3 px-4">Tồn đầu</th>
                      <th className="text-right py-3 px-4 text-green-700">Nhập</th>
                      <th className="text-right py-3 px-4 text-red-600">Xuất</th>
                      <th className="text-right py-3 px-4">Tồn cuối</th>
                      <th className="text-right py-3 px-4">Tồn hiện tại</th>
                    </tr>
                  </thead>
                  <tbody data-testid="xnt-table-body">
                    {xnt.items.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-ink-muted">Không có dữ liệu</td></tr>
                    ) : xnt.items.map((r) => (
                      <tr key={r.id} className="border-t border-border hover:bg-cream/30" data-testid={`xnt-row-${r.id}`}>
                        <td className="py-3 px-4 font-medium">{r.name}</td>
                        <td className="py-3 px-4 text-center text-xs">{r.unit}</td>
                        <td className="py-3 px-4 text-right font-mono">{r.opening_stock}</td>
                        <td className="py-3 px-4 text-right font-mono text-green-700">+{r.total_in}</td>
                        <td className="py-3 px-4 text-right font-mono text-red-600">-{r.total_out}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold">{r.ending_stock}</td>
                        <td className="py-3 px-4 text-right font-mono">{r.current_stock}</td>
                      </tr>
                    ))}
                    {xnt.items.length > 0 && (
                      <tr className="border-t-2 border-bamboo bg-cream/60 font-bold">
                        <td className="py-3 px-4">TỔNG</td>
                        <td></td>
                        <td className="py-3 px-4 text-right font-mono">{xnt.totals.total_opening}</td>
                        <td className="py-3 px-4 text-right font-mono text-green-700">+{xnt.totals.total_in}</td>
                        <td className="py-3 px-4 text-right font-mono text-red-600">-{xnt.totals.total_out}</td>
                        <td className="py-3 px-4 text-right font-mono">{xnt.totals.total_ending}</td>
                        <td></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "stockin" && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><ArrowLeftRight size={16} className="text-bamboo" /> Lịch sử nhập/xuất kho</CardTitle>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label>Loại</Label>
                  <Select value={movKind} onChange={(e) => setMovKind(e.target.value)} data-testid="mov-kind">
                    <option value="">Tất cả</option>
                    <option value="product">Sản phẩm</option>
                    <option value="material">Nguyên vật liệu</option>
                  </Select>
                </div>
                <div>
                  <Label>Từ ngày</Label>
                  <Input type="date" value={movDateFrom} onChange={(e) => setMovDateFrom(e.target.value)} data-testid="mov-date-from" />
                </div>
                <div>
                  <Label>Đến ngày</Label>
                  <Input type="date" value={movDateTo} onChange={(e) => setMovDateTo(e.target.value)} data-testid="mov-date-to" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="!p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="text-left py-3 px-4">Thời gian</th>
                    <th className="text-left py-3 px-4">Loại</th>
                    <th className="text-left py-3 px-4">Đối tượng</th>
                    <th className="text-center py-3 px-4">Hoạt động</th>
                    <th className="text-right py-3 px-4">SL</th>
                    <th className="text-right py-3 px-4">Đơn giá</th>
                    <th className="text-left py-3 px-4">Lô / HSD</th>
                    <th className="text-left py-3 px-4">Ghi chú</th>
                  </tr>
                </thead>
                <tbody data-testid="mov-table-body">
                  {movements.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-ink-muted">Không có dữ liệu</td></tr>
                  ) : movements.map((m) => (
                    <tr key={m.movement_id} className="border-t border-border hover:bg-cream/30" data-testid={`mov-row-${m.movement_id}`}>
                      <td className="py-3 px-4 text-xs">{formatDateTime(m.created_at)}</td>
                      <td className="py-3 px-4 text-xs">{m.kind === "product" ? "SP" : "NVL"}</td>
                      <td className="py-3 px-4 font-medium">{m.target_name}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={m.quantity_change > 0 ? "delivered" : "cancelled"}>{m.type || (m.quantity_change > 0 ? "nhập" : "xuất")}</Badge>
                      </td>
                      <td className={cn("py-3 px-4 text-right font-mono", m.quantity_change > 0 ? "text-green-700" : "text-red-600")}>
                        {m.quantity_change > 0 ? "+" : ""}{m.quantity_change}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs">{m.unit_price ? formatVND(m.unit_price) : "—"}</td>
                      <td className="py-3 px-4 text-xs">{m.batch_code || ""} {m.expiration_date ? `· HSD ${formatDate(m.expiration_date)}` : ""}</td>
                      <td className="py-3 px-4 text-xs text-ink-muted">{m.notes || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "batches" && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
                <tr>
                  <th className="text-left py-3 px-4">Mã lô</th>
                  <th className="text-left py-3 px-4">Sản phẩm</th>
                  <th className="text-center py-3 px-4">Ca</th>
                  <th className="text-right py-3 px-4">SL</th>
                  <th className="text-left py-3 px-4">Ngày SX</th>
                  <th className="text-left py-3 px-4">HSD</th>
                  <th className="text-left py-3 px-4">Người tạo</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody data-testid="production-table-body">
                {batches.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-ink-muted">Chưa có lô sản xuất</td></tr>
                ) : batches.map((b) => (
                  <tr key={b.batch_id} className="border-t border-border hover:bg-cream/30" data-testid={`production-row-${b.batch_id}`}>
                    <td className="py-3 px-4 font-mono text-xs">{b.batch_code}</td>
                    <td className="py-3 px-4 font-medium">{b.product_name}</td>
                    <td className="py-3 px-4 text-center"><Badge variant="regular">{SHIFTS.find((s) => s.id === b.shift)?.label || b.shift}</Badge></td>
                    <td className="py-3 px-4 text-right font-mono">{b.quantity}</td>
                    <td className="py-3 px-4 text-xs">{formatDate(b.production_date)}</td>
                    <td className="py-3 px-4 text-xs">{formatDate(b.expiration_date)}</td>
                    <td className="py-3 px-4 text-xs text-ink-muted">{b.created_by}</td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(b)} data-testid={`production-delete-${b.batch_id}`}>
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "forecast" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2"><Sparkles size={16} className="text-terracotta" /> Gợi ý sản xuất {forecast?.target_day_of_week ? `cho ${forecast.target_day_of_week} (${forecast.target_date})` : ""}</CardTitle>
              <Button variant="outline" size="sm" onClick={loadForecast} data-testid="forecast-refresh">Tải lại</Button>
            </div>
          </CardHeader>
          <CardContent className="!p-0">
            {!forecast ? (
              <div className="text-center py-8 text-ink-muted text-sm">Đang tải...</div>
            ) : forecast.forecasts.length === 0 ? (
              <div className="text-center py-8 text-ink-muted text-sm">
                Chưa đủ dữ liệu (cần ≥1 đơn hàng trong 28 ngày qua cùng thứ trong tuần). Hệ thống AI sẽ học khi có nhiều data hơn.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="text-left py-3 px-4">Sản phẩm</th>
                    <th className="text-right py-3 px-4">TB bán/ngày</th>
                    <th className="text-right py-3 px-4">Tồn hiện tại</th>
                    <th className="text-right py-3 px-4">Gợi ý sản xuất</th>
                    <th className="text-right py-3 px-4">Cần làm thêm</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.forecasts.map((f) => (
                    <tr key={f.product_id} className="border-t border-border" data-testid={`forecast-row-${f.product_id}`}>
                      <td className="py-3 px-4 font-medium">{f.name}</td>
                      <td className="py-3 px-4 text-right text-xs">{f.avg_daily_sold} ({f.samples} mẫu)</td>
                      <td className="py-3 px-4 text-right">{f.current_stock} {f.unit}</td>
                      <td className="py-3 px-4 text-right font-bold text-bamboo">{f.recommended_production} {f.unit}</td>
                      <td className="py-3 px-4 text-right">
                        {f.needs_to_produce > 0 ? (
                          <span className="font-bold text-terracotta">{f.needs_to_produce} {f.unit}</span>
                        ) : (
                          <Badge variant="delivered">Đủ</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Tạo lô sản xuất" size="lg" testId="production-modal">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Sản phẩm *</Label>
              <Select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required data-testid="production-form-product">
                <option value="">— Chọn sản phẩm —</option>
                {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Số lượng *</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} required data-testid="production-form-qty" />
            </div>
            <div>
              <Label>Ca sản xuất</Label>
              <Select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
                {SHIFTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Mã lô</Label>
              <Input value={form.batch_code} onChange={(e) => setForm({ ...form, batch_code: e.target.value })} placeholder="Tự sinh nếu để trống" />
            </div>
            <div>
              <Label>Ngày sản xuất</Label>
              <Input type="date" value={form.production_date} onChange={(e) => setForm({ ...form, production_date: e.target.value })} data-testid="production-form-prod-date" />
            </div>
            <div>
              <Label>HSD</Label>
              <Input type="date" value={form.expiration_date} onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} placeholder="Tự tính từ HSD mặc định" />
            </div>
          </div>

          {/* Materials used */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <Label>NVL đã sử dụng (tùy chọn)</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addMaterial}>+ Thêm NVL</Button>
            </div>
            {(form.materials_used || []).map((m, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2" data-testid={`production-material-${i}`}>
                <div className="col-span-7">
                  <Select value={m.material_id} onChange={(e) => updateMaterial(i, "material_id", e.target.value)}>
                    <option value="">— Chọn NVL —</option>
                    {materials.map((mat) => <option key={mat.material_id} value={mat.material_id}>{mat.name} (còn {mat.stock} {mat.unit})</option>)}
                  </Select>
                </div>
                <div className="col-span-4">
                  <Input type="number" min={0} step="any" value={m.quantity} onChange={(e) => updateMaterial(i, "quantity", Number(e.target.value))} placeholder="Số lượng dùng" />
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeMaterial(i)}>
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <Label>{t("common.notes")}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" data-testid="production-form-submit">{t("common.save")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
