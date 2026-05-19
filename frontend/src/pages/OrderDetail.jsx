import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, CheckCircle2, XCircle, Clock, Printer, Receipt, Copy, FileText } from "lucide-react";
import api from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Textarea, Label } from "../components/ui/Input";
import { toast } from "../components/ui/Toast";
import PrintPreview from "../components/ui/PrintPreview";
import { BillThermal, InvoiceA4, InvoiceA5Landscape } from "../components/print/BillTemplates";
import Pin2Prompt from "../components/ui/Pin2Prompt";
import { useI18n } from "../contexts/I18nContext";
import { formatVND, formatDateTime } from "../lib/utils";

const STATUS_ICONS = {
  new: Clock,
  processing: Clock,
  preparing: Clock,
  delivering: Truck,
  delivered: CheckCircle2,
  debt_pending: Clock,
  cancelled: XCircle,
};

const NEXT_STATUS = {
  new: ["processing", "delivering", "cancelled"],
  processing: ["delivering", "cancelled"],
  preparing: ["delivering", "cancelled"],
  delivering: ["delivered", "debt_pending", "cancelled"],
  delivered: [],
  debt_pending: ["delivered", "cancelled"],
  cancelled: [],
};

export default function OrderDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [shop, setShop] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusNote, setStatusNote] = useState("");
  const [printMode, setPrintMode] = useState(null); // "80mm" | "a4" | "a5"
  const [pin2Open, setPin2Open] = useState(false);
  const [pin2RetryAction, setPin2RetryAction] = useState(null); // function to retry on success

  const load = async () => {
    setLoading(true);
    try {
      const [o, s] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/settings`),
      ]);
      setOrder(o.data);
      setShop(s.data || {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const duplicate = async () => {
    navigate(`/orders/new?clone_from=${id}`);
  };

  const updateStatus = async (newStatus) => {
    const doUpdate = async () => {
      try {
        const { data } = await api.put(`/orders/${id}/status`, { status: newStatus, note: statusNote });
        setOrder(data);
        setStatusNote("");
        toast({ title: t("common.update") + " ✓", variant: "success" });
      } catch (e) {
        if (e?.response?.status === 403 && e?.response?.data?.detail === "PIN2_REQUIRED") {
          setPin2RetryAction(() => doUpdate);
          setPin2Open(true);
          return;
        }
        toast({ title: e?.response?.data?.detail || t("common.error"), variant: "error" });
      }
    };
    await doUpdate();
  };

  const removeOrder = async () => {
    if (!window.confirm(`Xóa đơn ${order.order_code}? Tồn kho sẽ được khôi phục.`)) return;
    const doDel = async () => {
      try {
        await api.delete(`/orders/${id}`);
        toast({ title: "Đã xóa đơn", variant: "success" });
        navigate("/orders");
      } catch (e) {
        if (e?.response?.status === 403 && e?.response?.data?.detail === "PIN2_REQUIRED") {
          setPin2RetryAction(() => doDel);
          setPin2Open(true);
          return;
        }
        toast({ title: e?.response?.data?.detail || t("common.error"), variant: "error" });
      }
    };
    await doDel();
  };

  if (loading) return <div className="text-sm text-ink-muted">{t("common.loading")}</div>;
  if (!order) return <div className="text-sm text-ink-muted">{t("common.empty")}</div>;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="order-detail-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/orders")} data-testid="order-detail-back">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold">{order.order_code}</h1>
            <p className="text-sm text-ink-muted">{formatDateTime(order.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={order.status} className="text-sm px-3 py-1">{t(`status.${order.status}`)}</Badge>
          <Button variant="outline" size="sm" onClick={duplicate} data-testid="order-duplicate">
            <Copy size={14} /> {t("orders.duplicate")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPrintMode("80mm")} data-testid="order-print-80mm">
            <Receipt size={14} /> Bill 80mm
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPrintMode("a4")} data-testid="order-print-a4">
            <FileText size={14} /> Hóa đơn A4
          </Button>
          <Button size="sm" onClick={() => setPrintMode("a5")} data-testid="order-print-a5">
            <Printer size={14} /> A5 ngang
          </Button>
          <Button variant="outline" size="sm" onClick={removeOrder} className="text-red-700 border-red-300 hover:bg-red-50" data-testid="order-delete">
            <XCircle size={14} /> Xóa đơn
          </Button>
        </div>
      </div>

      <Pin2Prompt
        open={pin2Open}
        onClose={() => { setPin2Open(false); setPin2RetryAction(null); }}
        onVerified={() => {
          setPin2Open(false);
          const fn = pin2RetryAction;
          setPin2RetryAction(null);
          if (typeof fn === "function") fn();
        }}
        action="thao tác trên đơn hàng"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("orders.items")}</CardTitle></CardHeader>
            <CardContent className="!p-0">
              <table className="w-full text-sm">
                <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="text-left py-2.5 px-4">{t("common.name")}</th>
                    <th className="text-right py-2.5 px-4">{t("common.price")}</th>
                    <th className="text-right py-2.5 px-4">{t("common.quantity")}</th>
                    <th className="text-right py-2.5 px-4">{t("orders.subtotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-3 px-4">{it.name}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs">{formatVND(it.price)}</td>
                      <td className="py-3 px-4 text-right">{it.quantity}</td>
                      <td className="py-3 px-4 text-right font-medium">{formatVND(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 space-y-1.5 border-t border-border">
                <div className="flex justify-between text-sm"><span>{t("orders.subtotal")}</span><span className="font-mono">{formatVND(order.subtotal)}</span></div>
                {order.discount_percent > 0 && (
                  <div className="flex justify-between text-sm text-ink-muted">
                    <span>Giảm {order.discount_percent}%</span>
                    <span className="font-mono">- {formatVND(Math.round(order.subtotal * order.discount_percent / 100))}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm text-ink-muted">
                    <span>{t("orders.discount")}</span>
                    <span className="font-mono">- {formatVND(order.discount)}</span>
                  </div>
                )}
                {order.shipping_fee > 0 && (
                  <div className="flex justify-between text-sm text-ink-muted">
                    <span>{t("orders.shipping")}</span>
                    <span className="font-mono">+ {formatVND(order.shipping_fee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-heading pt-2 border-t border-border">
                  <span className="font-semibold">{t("orders.total")}</span>
                  <span className="text-lg font-bold text-bamboo" data-testid="order-detail-total">{formatVND(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("orders.timeline")}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.timeline.map((entry, i) => {
                  const Icon = STATUS_ICONS[entry.status] || Clock;
                  return (
                    <div key={i} className="flex gap-3" data-testid={`timeline-${i}`}>
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-bamboo text-white flex items-center justify-center">
                          <Icon size={14} />
                        </div>
                        {i < order.timeline.length - 1 && <div className="w-0.5 flex-1 bg-border my-1" />}
                      </div>
                      <div className="pb-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={entry.status}>{t(`status.${entry.status}`)}</Badge>
                          <span className="text-xs text-ink-muted">{formatDateTime(entry.at)}</span>
                        </div>
                        <div className="text-xs text-ink-muted mt-1">{entry.by}</div>
                        {entry.note && <div className="text-sm text-ink mt-1">{entry.note}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("orders.customer")}</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="font-medium text-base">{order.customer_name}</div>
              {order.customer_phone && <div className="text-ink-muted">{order.customer_phone}</div>}
              {order.customer_address && <div className="text-ink-muted">{order.customer_address}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("orders.payment")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">{t("orders.payment")}</span><span>{t(`payment.${order.payment_method}`)}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Status</span>
                <Badge variant={order.is_paid ? "delivered" : "preparing"}>
                  {order.is_paid ? t("orders.paid") : t("orders.unpaid")}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {NEXT_STATUS[order.status].length > 0 && (
            <Card>
              <CardHeader><CardTitle>{t("orders.updateStatus")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>{t("orders.statusNote")}</Label>
                  <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder={t("orders.statusNote")} />
                </div>
                <div className="flex flex-col gap-2">
                  {NEXT_STATUS[order.status].map((s) => (
                    <Button
                      key={s}
                      variant={s === "cancelled" ? "outline" : "primary"}
                      onClick={() => updateStatus(s)}
                      className={s === "cancelled" ? "text-red-700 border-red-200 hover:bg-red-50" : ""}
                      data-testid={`order-update-status-${s}`}
                    >
                      → {t(`status.${s}`)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Print preview modal */}
      <PrintPreview
        open={printMode !== null}
        onClose={() => setPrintMode(null)}
        title={printMode === "80mm" ? "Bill 80mm" : printMode === "a5" ? "Hóa đơn A5 ngang" : "Hóa đơn A4"}
        printId="bill-print-area"
        pdfFilename={`bill-${order.order_code}.pdf`}
        pdfFormat={printMode === "80mm" ? "80mm" : printMode === "a5" ? "a5l" : "a4"}
      >
        {printMode === "80mm" ? (
          <BillThermal order={order} shop={shop} />
        ) : printMode === "a5" ? (
          <InvoiceA5Landscape order={order} shop={shop} />
        ) : (
          <InvoiceA4 order={order} shop={shop} />
        )}
      </PrintPreview>
    </div>
  );
}
