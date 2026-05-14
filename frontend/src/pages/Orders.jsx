import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Eye, Filter } from "lucide-react";
import api from "../lib/api";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Label } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { useI18n } from "../contexts/I18nContext";
import { formatVND, formatDateTime } from "../lib/utils";

export default function Orders() {
  const { t } = useI18n();
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (status) params.status = status;
    if (payment) params.payment_method = payment;
    try {
      const { data } = await api.get("/orders", { params });
      setOrders(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status, payment]);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="orders-page">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("orders.title")}</h1>
          <p className="text-sm text-ink-secondary mt-1">
            {orders.length} {t("common.total").toLowerCase()}
          </p>
        </div>
        <Link to="/orders/new">
          <Button data-testid="orders-new-button">
            <Plus size={16} />
            {t("orders.new")}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
            className="grid grid-cols-1 sm:grid-cols-4 gap-3"
            data-testid="orders-filters"
          >
            <div className="sm:col-span-2">
              <Label>{t("common.search")}</Label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={`${t("orders.code")} / ${t("orders.customer")}`}
                  className="pl-8"
                  data-testid="orders-search-input"
                />
              </div>
            </div>
            <div>
              <Label>{t("common.status")}</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="orders-status-filter">
                <option value="">{t("common.all")}</option>
                <option value="preparing">{t("status.preparing")}</option>
                <option value="delivering">{t("status.delivering")}</option>
                <option value="delivered">{t("status.delivered")}</option>
                <option value="cancelled">{t("status.cancelled")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("orders.payment")}</Label>
              <Select value={payment} onChange={(e) => setPayment(e.target.value)} data-testid="orders-payment-filter">
                <option value="">{t("common.all")}</option>
                <option value="cash">{t("payment.cash")}</option>
                <option value="transfer">{t("payment.transfer")}</option>
                <option value="cod">{t("payment.cod")}</option>
                <option value="card">{t("payment.card")}</option>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
              <tr>
                <th className="text-left py-3 px-4">{t("orders.code")}</th>
                <th className="text-left py-3 px-4">{t("orders.customer")}</th>
                <th className="text-left py-3 px-4">{t("orders.items")}</th>
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
                    <td className="py-3 px-4 text-xs text-ink-secondary">
                      {o.items?.length || 0} {t("common.quantity").toLowerCase()}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">{formatVND(o.total)}</td>
                    <td className="py-3 px-4 text-center text-xs">{t(`payment.${o.payment_method}`)}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={o.status}>{t(`status.${o.status}`)}</Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-ink-muted">{formatDateTime(o.created_at)}</td>
                    <td className="py-3 px-4 text-right">
                      <Link to={`/orders/${o.order_id}`}>
                        <Button variant="ghost" size="sm" data-testid={`order-view-${o.order_id}`}>
                          <Eye size={14} />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
