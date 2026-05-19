import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, Plus, Eye, Printer, Copy } from "lucide-react";
import api from "../lib/api";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Label } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import PrintPreview from "../components/ui/PrintPreview";
import { OrdersListPrint } from "../components/print/ReportTemplates";
import { toast } from "../components/ui/Toast";
import { useI18n } from "../contexts/I18nContext";
import { formatVND, formatDateTime } from "../lib/utils";

export default function Orders() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState(searchParams.get("date_from") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("date_to") || "");
  const [sort, setSort] = useState("created_at");
  const [direction, setDirection] = useState("desc");
  const [loading, setLoading] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = { sort, direction };
    if (q) params.q = q;
    if (status) params.status = status;
    if (payment) params.payment_method = payment;
    if (type) params.type = type;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    try {
      const { data } = await api.get("/orders", { params });
      setOrders(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, payment, type, dateFrom, dateTo, sort, direction]);

  const filterLabel = useMemo(() => {
    const parts = [];
    if (status) parts.push(t(`status.${status}`));
    if (payment) parts.push(t(`payment.${payment}`));
    if (type) parts.push(t(`orders.${type}`));
    if (dateFrom || dateTo) parts.push(`${dateFrom || "..."} → ${dateTo || "..."}`);
    if (q) parts.push(`"${q}"`);
    return parts.join(" · ");
  }, [status, payment, type, dateFrom, dateTo, q, t]);

  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);

  const duplicate = async (orderId) => {
    if (!window.confirm("Mở form đơn mới với thông tin từ đơn này? Bạn có thể chỉnh sửa trước khi lưu.")) return;
    navigate(`/orders/new?clone_from=${orderId}`);
  };

  const reset = () => {
    setQ(""); setStatus(""); setPayment(""); setType("");
    setDateFrom(""); setDateTo("");
    setSort("created_at"); setDirection("desc");
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="orders-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("orders.title")}</h1>
          <p className="text-sm text-ink-secondary mt-1">
            {orders.length} đơn · Doanh thu: <span className="font-medium text-bamboo">{formatVND(totalRevenue)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="md" onClick={() => setPrintOpen(true)} data-testid="orders-print-button">
            <Printer size={14} /> In / PDF
          </Button>
          <Link to="/orders/new">
            <Button data-testid="orders-new-button">
              <Plus size={16} />{t("orders.new")}
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="grid grid-cols-1 sm:grid-cols-8 gap-3" data-testid="orders-filters">
            <div className="sm:col-span-2">
              <Label>{t("common.search")}</Label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${t("orders.code")} / ${t("orders.customer")}`} className="pl-8" data-testid="orders-search-input" />
              </div>
            </div>
            <div>
              <Label>Từ ngày</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="orders-date-from" />
            </div>
            <div>
              <Label>Đến ngày</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="orders-date-to" />
            </div>
            <div>
              <Label>{t("common.status")}</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="orders-status-filter">
                <option value="">{t("common.all")}</option>
                <option value="new">{t("status.new")}</option>
                <option value="processing">{t("status.processing")}</option>
                <option value="delivering">{t("status.delivering")}</option>
                <option value="delivered">{t("status.delivered")}</option>
                <option value="debt_pending">{t("status.debt_pending")}</option>
                <option value="cancelled">{t("status.cancelled")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("orders.payment")}</Label>
              <Select value={payment} onChange={(e) => setPayment(e.target.value)} data-testid="orders-payment-filter">
                <option value="">{t("common.all")}</option>
                <option value="cash">{t("payment.cash")}</option>
                <option value="transfer">{t("payment.transfer")}</option>
                <option value="debt">{t("payment.debt")}</option>
                <option value="ewallet">{t("payment.ewallet")}</option>
                <option value="card">{t("payment.card")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("orders.type")}</Label>
              <Select value={type} onChange={(e) => setType(e.target.value)} data-testid="orders-type-filter">
                <option value="">{t("common.all")}</option>
                <option value="retail">{t("orders.retail")}</option>
                <option value="wholesale">{t("orders.wholesale")}</option>
                <option value="delivery">{t("orders.delivery")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("common.sort")}</Label>
              <div className="flex gap-1">
                <Select value={sort} onChange={(e) => setSort(e.target.value)} className="flex-1 text-xs" data-testid="orders-sort-field">
                  <option value="created_at">Ngày</option>
                  <option value="total">Tổng tiền</option>
                  <option value="customer_name">Tên KH</option>
                </Select>
                <Button type="button" size="sm" variant="outline" onClick={() => setDirection(direction === "asc" ? "desc" : "asc")} data-testid="orders-sort-direction" title={direction === "asc" ? "Tăng" : "Giảm"}>
                  {direction === "asc" ? "↑" : "↓"}
                </Button>
              </div>
            </div>
            <div className="sm:col-span-8 flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={reset} data-testid="orders-filters-reset">Xóa lọc</Button>
              <Button type="submit" size="sm" data-testid="orders-filters-apply">{t("common.filter")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
              <tr>
                <th className="text-left py-3 px-4">{t("orders.code")}</th>
                <th className="text-left py-3 px-4">{t("orders.customer")}</th>
                <th className="text-center py-3 px-4">{t("orders.type")}</th>
                <th className="text-right py-3 px-4">{t("orders.total")}</th>
                <th className="text-center py-3 px-4">{t("orders.payment")}</th>
                <th className="text-center py-3 px-4">{t("common.status")}</th>
                <th className="text-left py-3 px-4">{t("orders.date")}</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody data-testid="orders-table-body">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-ink-muted">{t("common.loading")}</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-ink-muted">{t("common.empty")}</td></tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.order_id} className="border-t border-border hover:bg-cream/30" data-testid={`order-row-${o.order_id}`}>
                    <td className="py-3 px-4 font-mono text-xs">{o.order_code}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{o.customer_name}</div>
                      <div className="text-xs text-ink-muted">{o.customer_phone}</div>
                    </td>
                    <td className="py-3 px-4 text-center text-xs">{t(`orders.${o.type || "retail"}`)}</td>
                    <td className="py-3 px-4 text-right font-medium">{formatVND(o.total)}</td>
                    <td className="py-3 px-4 text-center text-xs">{t(`payment.${o.payment_method}`)}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={o.status}>{t(`status.${o.status}`)}</Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-ink-muted">{formatDateTime(o.created_at)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => duplicate(o.order_id)} title="Nhân bản" data-testid={`order-duplicate-${o.order_id}`}>
                          <Copy size={14} />
                        </Button>
                        <Link to={`/orders/${o.order_id}`}>
                          <Button variant="ghost" size="icon" data-testid={`order-view-${o.order_id}`}>
                            <Eye size={14} />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <PrintPreview
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Danh sách đơn hàng"
        printId="orders-list-print"
        pdfFilename={`danh-sach-don-hang-${new Date().toISOString().slice(0, 10)}.pdf`}
        pdfFormat="a4"
      >
        <OrdersListPrint orders={orders} filterLabel={filterLabel} />
      </PrintPreview>
    </div>
  );
}
