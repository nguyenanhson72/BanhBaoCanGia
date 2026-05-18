import React, { useEffect, useState } from "react";
import { Wallet, AlertOctagon, Clock, Phone, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import api from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Label, Select, Textarea } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { toast } from "../components/ui/Toast";
import { useI18n } from "../contexts/I18nContext";
import { formatVND, formatDate, formatDateTime } from "../lib/utils";
import { cn } from "../lib/utils";

export default function Debts() {
  const { t } = useI18n();
  const [tab, setTab] = useState("customer");
  const [customerData, setCustomerData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [openCustomer, setOpenCustomer] = useState(null); // customer object to drill down
  const [openOrders, setOpenOrders] = useState([]);
  const [collectModal, setCollectModal] = useState(null); // { order }
  const [payModal, setPayModal] = useState(null); // { supplier }
  const [payAmount, setPayAmount] = useState(0);
  const [payNotes, setPayNotes] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  const load = async () => {
    if (tab === "customer") {
      const { data } = await api.get("/debts/customers");
      setCustomerData(data);
    }
    if (tab === "supplier") {
      const [s, p] = await Promise.all([api.get("/suppliers"), api.get("/debts/payments", { params: { direction: "out" } })]);
      setSuppliers(s.data);
      setPayments(p.data);
    }
    if (tab === "history") {
      const { data } = await api.get("/debts/payments");
      setPayments(data);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const drillCustomer = async (c) => {
    setOpenCustomer(c);
    const { data } = await api.get(`/debts/customers/${c.customer_id}/orders`);
    setOpenOrders(data);
  };

  const openCollect = (o) => {
    setCollectModal(o);
    setPayAmount(o.remaining_amount || o.total);
    setPayNotes("");
    setPayMethod("cash");
  };

  const submitCollect = async () => {
    try {
      await api.post("/debts/collect", {
        order_id: collectModal.order_id,
        amount: Number(payAmount),
        method: payMethod,
        notes: payNotes,
      });
      toast({ title: "Đã thu tiền", variant: "success" });
      setCollectModal(null);
      if (openCustomer) drillCustomer(openCustomer);
      load();
    } catch (e) {
      toast({ title: e?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  const openPaySupplier = (s) => {
    setPayModal(s);
    setPayAmount(0);
    setPayNotes("");
    setPayMethod("cash");
  };

  const submitPaySupplier = async () => {
    try {
      await api.post("/debts/pay-supplier", {
        supplier_id: payModal.supplier_id,
        amount: Number(payAmount),
        method: payMethod,
        notes: payNotes,
      });
      toast({ title: "Đã ghi nhận thanh toán", variant: "success" });
      setPayModal(null);
      load();
    } catch (e) {
      toast({ title: e?.response?.data?.detail || t("common.error"), variant: "error" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="debts-page">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <Wallet size={28} className="text-bamboo" /> {t("debts.title")}
        </h1>
        <p className="text-sm text-ink-secondary mt-1">{t("debts.customerDebts")} & {t("debts.supplierDebts")}</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        {[
          { id: "customer", label: t("debts.customerDebts"), icon: ArrowDownToLine },
          { id: "supplier", label: t("debts.supplierDebts"), icon: ArrowUpFromLine },
          { id: "history", label: t("debts.paymentHistory"), icon: Clock },
        ].map((x) => {
          const active = tab === x.id;
          const Icon = x.icon;
          return (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px",
                active ? "border-bamboo text-bamboo" : "border-transparent text-ink-muted hover:text-ink"
              )}
              data-testid={`debts-tab-${x.id}`}
            >
              <Icon size={14} /> {x.label}
            </button>
          );
        })}
      </div>

      {/* CUSTOMER DEBTS */}
      {tab === "customer" && customerData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent>
                <div className="text-xs uppercase tracking-wider text-ink-muted">{t("debts.totalDebt")}</div>
                <div className="font-heading text-2xl font-bold mt-1">{formatVND(customerData.total)}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent>
                <div className="text-xs uppercase tracking-wider text-amber-700">{t("debts.dueSoon")}</div>
                <div className="font-heading text-2xl font-bold mt-1 text-amber-700">{formatVND(customerData.due_soon_total)}</div>
              </CardContent>
            </Card>
            <Card className="border-red-300">
              <CardContent>
                <div className="text-xs uppercase tracking-wider text-red-700">{t("debts.overdue")}</div>
                <div className="font-heading text-2xl font-bold mt-1 text-red-700">{formatVND(customerData.overdue_total)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="text-left py-3 px-4">Khách hàng</th>
                    <th className="text-left py-3 px-4">SĐT</th>
                    <th className="text-right py-3 px-4">Số đơn</th>
                    <th className="text-right py-3 px-4">Tổng nợ</th>
                    <th className="text-left py-3 px-4">Hạn gần nhất</th>
                    <th className="text-center py-3 px-4">{t("common.status")}</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody data-testid="debts-customer-table">
                  {customerData.items.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-ink-muted">{t("common.empty")}</td></tr>
                  ) : customerData.items.map((d, i) => (
                    <tr key={i} className="border-t border-border hover:bg-cream/30" data-testid={`debt-customer-${i}`}>
                      <td className="py-3 px-4 font-medium">{d.customer_name}</td>
                      <td className="py-3 px-4 text-xs">{d.phone}</td>
                      <td className="py-3 px-4 text-right">{d.order_count}</td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-terracotta">{formatVND(d.total_debt)}</td>
                      <td className="py-3 px-4 text-xs text-ink-muted">{d.earliest_due ? formatDate(d.earliest_due) : "—"}</td>
                      <td className="py-3 px-4 text-center">
                        {d.overdue ? <Badge variant="cancelled">Quá hạn</Badge> :
                        d.due_soon ? <Badge variant="lowstock">Sắp đến hạn</Badge> :
                        <Badge variant="regular">Trong hạn</Badge>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => drillCustomer(d)} data-testid={`debt-customer-detail-${i}`}>
                          Chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* SUPPLIER DEBTS */}
      {tab === "supplier" && (
        <Card>
          <CardHeader><CardTitle>{t("debts.supplierDebts")}</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
                <tr>
                  <th className="text-left py-3 px-4">Mã NCC</th>
                  <th className="text-left py-3 px-4">Tên NCC</th>
                  <th className="text-left py-3 px-4">SĐT</th>
                  <th className="text-right py-3 px-4">Công nợ</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody data-testid="debts-supplier-table">
                {suppliers.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-ink-muted">{t("common.empty")}</td></tr>
                ) : suppliers.map((s) => (
                  <tr key={s.supplier_id} className="border-t border-border" data-testid={`debt-supplier-${s.supplier_id}`}>
                    <td className="py-3 px-4 font-mono text-xs">{s.code}</td>
                    <td className="py-3 px-4 font-medium">{s.name}</td>
                    <td className="py-3 px-4 text-xs">{s.phone}</td>
                    <td className="py-3 px-4 text-right font-mono">{formatVND(s.total_debt || 0)}</td>
                    <td className="py-3 px-4 text-right">
                      <Button size="sm" onClick={() => openPaySupplier(s)} data-testid={`debt-pay-${s.supplier_id}`}>
                        {t("debts.payToSupplier")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* PAYMENT HISTORY */}
      {tab === "history" && (
        <Card>
          <CardHeader><CardTitle>{t("debts.paymentHistory")}</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
                <tr>
                  <th className="text-left py-3 px-4">Ngày</th>
                  <th className="text-left py-3 px-4">Hướng</th>
                  <th className="text-left py-3 px-4">Đối tượng</th>
                  <th className="text-left py-3 px-4">Phương thức</th>
                  <th className="text-right py-3 px-4">Số tiền</th>
                  <th className="text-left py-3 px-4">Ghi chú</th>
                </tr>
              </thead>
              <tbody data-testid="debts-history-table">
                {payments.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-ink-muted">{t("common.empty")}</td></tr>
                ) : payments.map((p) => (
                  <tr key={p.payment_id} className="border-t border-border">
                    <td className="py-3 px-4 text-xs text-ink-muted">{formatDateTime(p.created_at)}</td>
                    <td className="py-3 px-4">
                      {p.direction === "in" ?
                        <Badge variant="delivered">Thu</Badge> :
                        <Badge variant="lowstock">Chi</Badge>}
                    </td>
                    <td className="py-3 px-4 font-medium">{p.customer_name || p.supplier_name}</td>
                    <td className="py-3 px-4 text-xs">{t(`payment.${p.method}`)}</td>
                    <td className={`py-3 px-4 text-right font-mono ${p.direction === "in" ? "text-emerald-700" : "text-red-700"}`}>
                      {p.direction === "in" ? "+" : "-"} {formatVND(p.amount)}
                    </td>
                    <td className="py-3 px-4 text-xs text-ink-muted">{p.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Customer drill-down modal */}
      <Modal open={!!openCustomer} onClose={() => setOpenCustomer(null)} title={`Công nợ: ${openCustomer?.customer_name || ""}`} size="xl" testId="debt-detail-modal">
        <div className="space-y-3">
          <div className="text-sm">
            Tổng nợ: <span className="font-bold text-terracotta">{formatVND(openCustomer?.total_debt || 0)}</span> · {openOrders.length} đơn
          </div>
          <table className="w-full text-sm">
            <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
              <tr>
                <th className="text-left py-2 px-3">Mã đơn</th>
                <th className="text-left py-2 px-3">Ngày</th>
                <th className="text-right py-2 px-3">Tổng</th>
                <th className="text-right py-2 px-3">Đã trả</th>
                <th className="text-right py-2 px-3">Còn nợ</th>
                <th className="text-center py-2 px-3">Hạn</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {openOrders.map((o) => (
                <tr key={o.order_id} className="border-t border-border">
                  <td className="py-2 px-3 font-mono text-xs">{o.order_code}</td>
                  <td className="py-2 px-3 text-xs">{formatDate(o.created_at)}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatVND(o.total)}</td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-700">{formatVND(o.paid_amount || 0)}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-terracotta">{formatVND(o.remaining_amount || o.total)}</td>
                  <td className="py-2 px-3 text-center text-xs">
                    {o.overdue ? <Badge variant="cancelled">Quá {Math.abs(o.days_to_due)}d</Badge> :
                    o.due_soon ? <Badge variant="lowstock">{o.days_to_due}d</Badge> :
                    o.days_to_due != null ? <span className="text-xs text-ink-muted">{o.days_to_due}d</span> : "—"}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <Button size="sm" onClick={() => openCollect(o)} data-testid={`debt-collect-${o.order_id}`}>
                      {t("debts.collect")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Collect modal */}
      <Modal open={!!collectModal} onClose={() => setCollectModal(null)} title={`Thu tiền: ${collectModal?.order_code || ""}`} testId="collect-modal">
        <div className="space-y-3">
          <div className="text-sm">Còn nợ: <span className="font-bold text-terracotta">{formatVND(collectModal?.remaining_amount || collectModal?.total || 0)}</span></div>
          <div>
            <Label>Số tiền thu</Label>
            <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} data-testid="collect-amount" />
          </div>
          <div>
            <Label>Phương thức</Label>
            <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="cash">Tiền mặt</option>
              <option value="transfer">Chuyển khoản</option>
              <option value="ewallet">Ví điện tử</option>
              <option value="card">Thẻ</option>
            </Select>
          </div>
          <div>
            <Label>{t("common.notes")}</Label>
            <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCollectModal(null)}>{t("common.cancel")}</Button>
            <Button onClick={submitCollect} data-testid="collect-submit">{t("common.confirm")}</Button>
          </div>
        </div>
      </Modal>

      {/* Pay supplier modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`Trả tiền NCC: ${payModal?.name || ""}`} testId="pay-modal">
        <div className="space-y-3">
          <div>
            <Label>Số tiền trả</Label>
            <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} data-testid="pay-amount" />
          </div>
          <div>
            <Label>Phương thức</Label>
            <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="cash">Tiền mặt</option>
              <option value="transfer">Chuyển khoản</option>
            </Select>
          </div>
          <div>
            <Label>{t("common.notes")}</Label>
            <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPayModal(null)}>{t("common.cancel")}</Button>
            <Button onClick={submitPaySupplier} data-testid="pay-submit">{t("common.confirm")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
