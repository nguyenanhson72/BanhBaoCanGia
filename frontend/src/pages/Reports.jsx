import React, { useEffect, useState } from "react";
import { BarChart3, Wallet, Package, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useI18n } from "../contexts/I18nContext";
import { formatVND, formatDate } from "../lib/utils";
import { cn } from "../lib/utils";

export default function Reports() {
  const { t } = useI18n();
  const [tab, setTab] = useState("revenue");
  const [period, setPeriod] = useState("daily");
  const [revenue, setRevenue] = useState(null);
  const [debt, setDebt] = useState(null);
  const [inventory, setInventory] = useState(null);

  useEffect(() => {
    if (tab === "revenue") api.get(`/reports/revenue?period=${period}`).then((r) => setRevenue(r.data));
    if (tab === "debt" && !debt) api.get("/reports/debt").then((r) => setDebt(r.data));
    if (tab === "inventory" && !inventory) api.get("/reports/inventory").then((r) => setInventory(r.data));
  }, [tab, period]);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="reports-page">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t("reports.title")}</h1>
        <p className="text-sm text-ink-secondary mt-1">{t("reports.revenue")}, {t("reports.debt")}, {t("reports.inventory")}</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        {[
          { id: "revenue", icon: BarChart3, label: t("reports.revenue") },
          { id: "debt", icon: Wallet, label: t("reports.debt") },
          { id: "inventory", icon: Package, label: t("reports.inventory") },
        ].map((tabItem) => {
          const Icon = tabItem.icon;
          const active = tab === tabItem.id;
          return (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px",
                active ? "border-bamboo text-bamboo" : "border-transparent text-ink-muted hover:text-ink"
              )}
              data-testid={`reports-tab-${tabItem.id}`}
            >
              <Icon size={14} /> {tabItem.label}
            </button>
          );
        })}
      </div>

      {tab === "revenue" && revenue && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("reports.revenue")}</CardTitle>
              <div className="flex gap-1">
                {["daily", "weekly", "monthly"].map((p) => (
                  <Button key={p} size="sm" variant={period === p ? "primary" : "outline"} onClick={() => setPeriod(p)} data-testid={`reports-period-${p}`}>
                    {t(`reports.${p}`)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EAE5D9" vertical={false} />
                  <XAxis dataKey="label" stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717A" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${v / 1000}k`)} />
                  <Tooltip contentStyle={{ background: "white", border: "1px solid #E4E4E7", borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => formatVND(v)} />
                  <Bar dataKey="revenue" fill="#2D4A22" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "debt" && debt && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("reports.debt")}</CardTitle>
              <div className="text-sm">
                {t("common.total")}: <span className="font-bold text-terracotta" data-testid="reports-debt-total">{formatVND(debt.total)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="!p-0">
            <table className="w-full text-sm">
              <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
                <tr>
                  <th className="text-left py-3 px-4">{t("orders.customer")}</th>
                  <th className="text-left py-3 px-4">{t("common.phone")}</th>
                  <th className="text-right py-3 px-4">{t("reports.debtAmount")}</th>
                  <th className="text-right py-3 px-4">{t("customers.totalOrders")}</th>
                  <th className="text-right py-3 px-4">{t("reports.lastOrder")}</th>
                </tr>
              </thead>
              <tbody data-testid="reports-debt-table">
                {debt.items.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-ink-muted">{t("common.empty")}</td></tr>
                ) : debt.items.map((d, i) => (
                  <tr key={i} className="border-t border-border" data-testid={`debt-row-${i}`}>
                    <td className="py-3 px-4 font-medium">{d.customer_name}</td>
                    <td className="py-3 px-4 text-xs">{d.phone}</td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-terracotta">{formatVND(d.debt)}</td>
                    <td className="py-3 px-4 text-right">{d.orders}</td>
                    <td className="py-3 px-4 text-right text-xs text-ink-muted">{formatDate(d.last_order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {tab === "inventory" && inventory && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent>
                <div className="text-xs uppercase tracking-wider text-ink-muted">{t("dashboard.totalProducts")}</div>
                <div className="font-heading text-2xl font-bold mt-1">{inventory.total_products}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="text-xs uppercase tracking-wider text-ink-muted">{t("reports.totalValue")}</div>
                <div className="font-heading text-2xl font-bold mt-1">{formatVND(inventory.total_stock_value)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="text-xs uppercase tracking-wider text-ink-muted">{t("products.lowStockOnly")}</div>
                <div className="font-heading text-2xl font-bold mt-1 text-amber-600">{inventory.low_stock_count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="text-xs uppercase tracking-wider text-ink-muted">{t("reports.outOfStock")}</div>
                <div className="font-heading text-2xl font-bold mt-1 text-red-600">{inventory.out_of_stock_count}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>{t("reports.inventory")}</CardTitle></CardHeader>
            <CardContent className="!p-0">
              <table className="w-full text-sm">
                <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="text-left py-3 px-4">{t("products.name")}</th>
                    <th className="text-left py-3 px-4">{t("products.category")}</th>
                    <th className="text-right py-3 px-4">{t("products.stock")}</th>
                    <th className="text-right py-3 px-4">{t("products.cost")}</th>
                    <th className="text-right py-3 px-4">{t("reports.totalValue")}</th>
                    <th className="text-center py-3 px-4">{t("common.status")}</th>
                  </tr>
                </thead>
                <tbody data-testid="reports-inventory-table">
                  {inventory.products.map((p) => {
                    const value = (p.stock || 0) * (p.cost || 0);
                    const out = p.stock === 0;
                    const low = !out && p.stock <= p.low_stock_threshold;
                    return (
                      <tr key={p.product_id} className="border-t border-border" data-testid={`inventory-row-${p.product_id}`}>
                        <td className="py-3 px-4 font-medium">{p.name}</td>
                        <td className="py-3 px-4 text-xs">{p.category}</td>
                        <td className="py-3 px-4 text-right">{p.stock} {p.unit}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs">{formatVND(p.cost)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatVND(value)}</td>
                        <td className="py-3 px-4 text-center">
                          {out ? <Badge variant="cancelled">{t("reports.outOfStock")}</Badge> :
                          low ? <Badge variant="lowstock">{t("products.lowStockOnly")}</Badge> :
                          <Badge variant="delivered">OK</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
