import React, { useEffect, useState } from "react";
import { BarChart3, Wallet, Package, Printer, FileDown, AlertOctagon } from "lucide-react";
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
import { Input, Label } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import PrintPreview from "../components/ui/PrintPreview";
import {
  RevenueReportPrint,
  DebtReportPrint,
  InventoryReportPrint,
} from "../components/print/ReportTemplates";
import { useI18n } from "../contexts/I18nContext";
import { formatVND, formatDate } from "../lib/utils";
import { cn } from "../lib/utils";

export default function Reports() {
  const { t } = useI18n();
  const [tab, setTab] = useState("revenue");
  const [period, setPeriod] = useState("daily");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [revenue, setRevenue] = useState(null);
  const [debt, setDebt] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);

  const loadRevenue = async () => {
    const params = {};
    if (dateFrom && dateTo) {
      params.date_from = dateFrom;
      params.date_to = dateTo;
    } else {
      params.period = period;
    }
    const { data } = await api.get("/reports/revenue", { params });
    setRevenue(data);
  };

  useEffect(() => {
    if (tab === "revenue") loadRevenue();
    if (tab === "debt" && !debt) api.get("/reports/debt").then((r) => setDebt(r.data));
    if (tab === "inventory" && !inventory) api.get("/reports/inventory").then((r) => setInventory(r.data));
    // eslint-disable-next-line
  }, [tab, period, dateFrom, dateTo]);

  const printConfig = (() => {
    if (tab === "revenue") {
      const range = dateFrom && dateTo ? `${dateFrom} đến ${dateTo}` : { daily: "30 ngày", weekly: "12 tuần", monthly: "12 tháng" }[period];
      return {
        title: `Báo cáo doanh thu`,
        filename: `bao-cao-doanh-thu-${new Date().toISOString().slice(0, 10)}.pdf`,
        content: <RevenueReportPrint data={revenue?.data || []} period={period} dateFrom={dateFrom} dateTo={dateTo} />,
      };
    }
    if (tab === "debt") {
      return {
        title: "Báo cáo công nợ",
        filename: `bao-cao-cong-no-${new Date().toISOString().slice(0, 10)}.pdf`,
        content: <DebtReportPrint items={debt?.items || []} total={debt?.total || 0} />,
      };
    }
    return {
      title: "Báo cáo tồn kho",
      filename: `bao-cao-ton-kho-${new Date().toISOString().slice(0, 10)}.pdf`,
      content: <InventoryReportPrint data={inventory || {}} />,
    };
  })();

  const resetDateRange = () => {
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="reports-page">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t("reports.title")}</h1>
          <p className="text-sm text-ink-secondary mt-1">{t("reports.revenue")}, {t("reports.debt")}, {t("reports.inventory")}</p>
        </div>
        <Button variant="outline" onClick={() => setPrintOpen(true)} data-testid="reports-print-button">
          <Printer size={14} /> In / PDF
        </Button>
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
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>{t("reports.revenue")}</CardTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-end gap-2">
                  <div>
                    <Label className="!mb-0.5">Từ</Label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" data-testid="reports-date-from" />
                  </div>
                  <div>
                    <Label className="!mb-0.5">Đến</Label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" data-testid="reports-date-to" />
                  </div>
                  {(dateFrom || dateTo) && (
                    <Button type="button" size="sm" variant="ghost" onClick={resetDateRange} data-testid="reports-date-reset">
                      Xóa
                    </Button>
                  )}
                </div>
                <div className="flex gap-1">
                  {["daily", "weekly", "monthly"].map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={(!dateFrom && !dateTo && period === p) ? "primary" : "outline"}
                      onClick={() => { setPeriod(p); resetDateRange(); }}
                      data-testid={`reports-period-${p}`}
                    >
                      {t(`reports.${p}`)}
                    </Button>
                  ))}
                </div>
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent>
                <div className="text-xs uppercase tracking-wider text-ink-muted">{t("dashboard.totalProducts")}</div>
                <div className="font-heading text-2xl font-bold mt-1">{inventory.total_products}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="text-xs uppercase tracking-wider text-ink-muted">{t("reports.totalValue")}</div>
                <div className="font-heading text-xl font-bold mt-1">{formatVND(inventory.total_stock_value)}</div>
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
            <Card className={inventory.negative_stock_count > 0 ? "border-red-300 ring-1 ring-red-200" : ""}>
              <CardContent>
                <div className="text-xs uppercase tracking-wider text-ink-muted">Âm hàng</div>
                <div className="font-heading text-2xl font-bold mt-1 text-red-700">{inventory.negative_stock_count || 0}</div>
              </CardContent>
            </Card>
          </div>

          {inventory.negative_stock_count > 0 && (
            <Card className="border-red-300 bg-red-50/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertOctagon size={18} className="text-red-700" />
                  <CardTitle className="text-red-800">Hàng âm — cần kiểm tra ngay</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="!p-0">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 text-xs uppercase text-red-700/70">
                    <tr>
                      <th className="text-left py-3 px-4">Tên hàng</th>
                      <th className="text-left py-3 px-4">Danh mục</th>
                      <th className="text-right py-3 px-4">Tồn</th>
                    </tr>
                  </thead>
                  <tbody data-testid="reports-negative-stock-table">
                    {inventory.negative_stock_products.map((p) => (
                      <tr key={p.product_id} className="border-t border-red-200" data-testid={`negative-row-${p.product_id}`}>
                        <td className="py-3 px-4 font-medium">{p.name}</td>
                        <td className="py-3 px-4 text-xs">{p.category}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-red-700">{p.stock} {p.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

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
                    const negative = p.stock < 0;
                    const out = p.stock === 0;
                    const low = !out && !negative && p.stock <= p.low_stock_threshold;
                    return (
                      <tr key={p.product_id} className="border-t border-border" data-testid={`inventory-row-${p.product_id}`}>
                        <td className="py-3 px-4 font-medium">{p.name}</td>
                        <td className="py-3 px-4 text-xs">{p.category}</td>
                        <td className={cn("py-3 px-4 text-right", negative && "text-red-700 font-bold")}>{p.stock} {p.unit}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs">{formatVND(p.cost)}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatVND(value)}</td>
                        <td className="py-3 px-4 text-center">
                          {negative ? <Badge variant="cancelled">Âm</Badge> :
                          out ? <Badge variant="cancelled">{t("reports.outOfStock")}</Badge> :
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

      <PrintPreview
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title={printConfig.title}
        printId="report-print-area"
        pdfFilename={printConfig.filename}
        pdfFormat="a4"
      >
        {printConfig.content}
      </PrintPreview>
    </div>
  );
}
