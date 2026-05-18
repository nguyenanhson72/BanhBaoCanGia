import React, { useEffect, useState, useRef } from "react";
import { Plus, Search, Edit, Trash2, Upload, Download, FileSpreadsheet } from "lucide-react";
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
  name: "", code: "", nickname: "",
  phone: "", email: "", address: "", district: "", city: "",
  tax_id: "", group: "new", type: "retail", classification: "",
  assigned_user_id: "", max_debt_days: 0, max_debt_amount: 0, notes: "",
};

export default function Customers() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [type, setType] = useState("");
  const [district, setDistrict] = useState("");
  const [sort, setSort] = useState("created_at");
  const [direction, setDirection] = useState("desc");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    const params = { sort, direction };
    if (q) params.q = q;
    if (group) params.group = group;
    if (type) params.type = type;
    if (district) params.district = district;
    const { data } = await api.get("/customers", { params });
    setItems(data);
  };

  useEffect(() => {
    load();
    api.get("/users").then((r) => setUsers(r.data)).catch(() => {});
    /* eslint-disable-next-line */
  }, [group, type, district, sort, direction]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ ...EMPTY, ...c });
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
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`${t("common.delete")} "${c.name}"?`)) return;
    try {
      await api.delete(`/customers/${c.customer_id}`);
      toast({ title: t("common.deleted"), variant: "success" });
      load();
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/customers/import-template", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "customers-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Tải mẫu thất bại", variant: "error" });
    }
  };

  const exportExcel = async () => {
    try {
      const res = await api.get("/customers/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Xuất Excel thất bại", variant: "error" });
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/customers/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setImportResult(data);
      toast({ title: `Đã nhập ${data.inserted} khách hàng`, description: `Bỏ qua: ${data.skipped}`, variant: "success" });
      load();
    } catch (err) {
      toast({ title: err?.response?.data?.detail || "Lỗi nhập file", variant: "error" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const districts = Array.from(new Set(items.map((i) => i.district).filter(Boolean)));

  return (
    <div className="space-y-6 animate-fade-in" data-testid="customers-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("customers.title")}</h1>
          <p className="text-sm text-ink-secondary mt-1">{items.length} {t("common.total").toLowerCase()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="customers-template">
            <FileSpreadsheet size={14} /> {t("customers.downloadTemplate")}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" data-testid="customers-import-file" />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} data-testid="customers-import-button">
            <Upload size={14} /> {t("customers.importExcel")}
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} data-testid="customers-export-button">
            <Download size={14} /> {t("customers.exportExcel")}
          </Button>
          <Button onClick={openCreate} data-testid="customers-new-button">
            <Plus size={16} /> {t("common.add")}
          </Button>
        </div>
      </div>

      {importResult && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent>
            <div className="text-sm">
              <strong>{t("customers.importResult")}:</strong> Nhập <strong>{importResult.inserted}</strong> · Bỏ qua: <strong>{importResult.skipped}</strong>
              {importResult.errors?.length > 0 && (
                <ul className="mt-2 text-xs text-red-700 list-disc list-inside">
                  {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="text-xs text-bamboo hover:underline mt-2">Đóng</button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="grid grid-cols-1 sm:grid-cols-6 gap-3">
            <div className="sm:col-span-2">
              <Label>{t("common.search")}</Label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên / SĐT / Mã" className="pl-8" data-testid="customers-search" />
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
            <div>
              <Label>{t("customers.type")}</Label>
              <Select value={type} onChange={(e) => setType(e.target.value)} data-testid="customers-type-filter">
                <option value="">{t("common.all")}</option>
                <option value="retail">{t("customers.retail")}</option>
                <option value="wholesale">{t("customers.wholesale")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("common.district")}</Label>
              <Select value={district} onChange={(e) => setDistrict(e.target.value)} data-testid="customers-district-filter">
                <option value="">{t("common.all")}</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
            <div>
              <Label>{t("common.sort")}</Label>
              <div className="flex gap-1">
                <Select value={sort} onChange={(e) => setSort(e.target.value)} className="text-xs flex-1" data-testid="customers-sort-field">
                  <option value="created_at">Mới tạo</option>
                  <option value="name">Tên</option>
                  <option value="total_spent">Tổng chi</option>
                  <option value="total_orders">Số đơn</option>
                </Select>
                <Button type="button" size="sm" variant="outline" onClick={() => setDirection(direction === "asc" ? "desc" : "asc")} data-testid="customers-sort-direction" title={direction === "asc" ? "Tăng" : "Giảm"}>
                  {direction === "asc" ? "↑" : "↓"}
                </Button>
              </div>
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
                <th className="text-left py-3 px-4">{t("common.name")}</th>
                <th className="text-left py-3 px-4">{t("common.phone")}</th>
                <th className="text-left py-3 px-4">Khu vực</th>
                <th className="text-center py-3 px-4">{t("customers.type")}</th>
                <th className="text-center py-3 px-4">{t("customers.group")}</th>
                <th className="text-right py-3 px-4">Hạn nợ (ngày/tiền)</th>
                <th className="text-right py-3 px-4">Tổng chi</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody data-testid="customers-table-body">
              {items.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-ink-muted">{t("common.empty")}</td></tr>
              ) : items.map((c) => (
                <tr key={c.customer_id} className="border-t border-border hover:bg-cream/30" data-testid={`customer-row-${c.customer_id}`}>
                  <td className="py-3 px-4 font-mono text-xs">{c.code}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{c.name}</div>
                    {c.nickname && <div className="text-xs text-ink-muted">({c.nickname})</div>}
                  </td>
                  <td className="py-3 px-4 text-xs">{c.phone}</td>
                  <td className="py-3 px-4 text-xs">{c.district ? `${c.district}` : "—"}</td>
                  <td className="py-3 px-4 text-center text-xs">{t(`customers.${c.type || "retail"}`)}</td>
                  <td className="py-3 px-4 text-center"><Badge variant={c.group}>{t(`customers.${c.group}`)}</Badge></td>
                  <td className="py-3 px-4 text-right text-xs">
                    {c.max_debt_days ? `${c.max_debt_days}d` : "—"} / {c.max_debt_amount ? formatVND(c.max_debt_amount) : "—"}
                  </td>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("common.edit") : t("common.add")} size="lg" testId="customer-modal">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("customers.code")}</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Tự sinh" data-testid="customer-form-code" />
            </div>
            <div>
              <Label>{t("common.name")} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="customer-form-name" />
            </div>
            <div>
              <Label>{t("customers.nickname")}</Label>
              <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="VD: Chị Lan, Anh Hùng..." data-testid="customer-form-nickname" />
            </div>
            <div>
              <Label>{t("customers.taxId")}</Label>
              <Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} placeholder="MST hoặc CCCD" />
            </div>
            <div>
              <Label>{t("common.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="customer-form-phone" />
            </div>
            <div>
              <Label>{t("common.email")}</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("common.address")}</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Địa chỉ chi tiết" data-testid="customer-form-address" />
            </div>
            <div>
              <Label>{t("common.district")}</Label>
              <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="VD: Quận 1" data-testid="customer-form-district" />
            </div>
            <div>
              <Label>{t("common.city")}</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="VD: TP.HCM" />
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
              <Label>{t("customers.type")}</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} data-testid="customer-form-type">
                <option value="retail">{t("customers.retail")}</option>
                <option value="wholesale">{t("customers.wholesale")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("customers.classification")}</Label>
              <Input value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value })} placeholder="Tự tạo nhóm tùy chỉnh" data-testid="customer-form-classification" />
            </div>
            <div>
              <Label>{t("customers.assignedUser")}</Label>
              <Select value={form.assigned_user_id} onChange={(e) => setForm({ ...form, assigned_user_id: e.target.value })} data-testid="customer-form-assigned-user">
                <option value="">— Không —</option>
                {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>{t("customers.maxDebtDays")}</Label>
              <Input type="number" min={0} value={form.max_debt_days} onChange={(e) => setForm({ ...form, max_debt_days: Number(e.target.value) })} data-testid="customer-form-max-debt-days" />
            </div>
            <div>
              <Label>{t("customers.maxDebtAmount")} (VND)</Label>
              <Input type="number" min={0} value={form.max_debt_amount} onChange={(e) => setForm({ ...form, max_debt_amount: Number(e.target.value) })} data-testid="customer-form-max-debt-amount" />
            </div>
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
