import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  ShoppingBag,
  Wallet,
  Package,
  AlertTriangle,
  ArrowRight,
  Plus,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Bar,
  BarChart,
} from "recharts";
import api from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { useI18n } from "../contexts/I18nContext";
import { useAuth } from "../contexts/AuthContext";
import { formatVND, timeAgo } from "../lib/utils";

function hasPerm(user, perm) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const perms = user.permissions_effective || user.permissions || [];
  return perms.includes(perm);
}

function KpiCard({ icon: Icon, title, value, hint, accent = "bamboo", testId, to }) {
  const accents = {
    bamboo: "bg-bamboo/10 text-bamboo",
    terracotta: "bg-terracotta/10 text-terracotta",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
  };
  const inner = (
    <Card className="hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer" data-testid={testId}>
      <CardContent>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-ink-muted font-medium">
              {title}
            </div>
            <div className="font-heading text-3xl font-bold tracking-tight text-ink">{value}</div>
            {hint && <div className="text-xs text-ink-secondary">{hint}</div>}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accents[accent]}`}>
            <Icon size={20} strokeWidth={2.1} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const canSeeRevenue = hasPerm(user, "reports.view");
  const canSeeOrders = hasPerm(user, "orders.view");
  const canSeeDebts = hasPerm(user, "debts.view");
  const canSeeProducts = hasPerm(user, "products.view");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/dashboard/stats");
        setStats(data);
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading)
    return <div className="text-sm text-ink-muted" data-testid="dashboard-loading">{t("common.loading")}</div>;

  if (!stats) return null;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-ink">
            {t("dashboard.title")}
          </h1>
          <p className="text-sm text-ink-secondary mt-1">{t("dashboard.subtitle")}</p>
        </div>
        <Link to="/orders/new">
          <Button data-testid="dashboard-quick-new-order">
            <Plus size={16} />
            {t("dashboard.newOrder")}
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {canSeeRevenue && (
          <KpiCard
            icon={TrendingUp}
            title={t("dashboard.todayRevenue")}
            value={formatVND(stats.today_revenue)}
            accent="bamboo"
            testId="kpi-today-revenue"
            to={`/orders?date_from=${new Date().toISOString().slice(0,10)}&date_to=${new Date().toISOString().slice(0,10)}`}
          />
        )}
        {canSeeOrders && (
          <KpiCard
            icon={ShoppingBag}
            title={t("dashboard.todayOrders")}
            value={stats.today_orders}
            accent="terracotta"
            testId="kpi-today-orders"
            to="/orders"
          />
        )}
        {canSeeDebts && (
          <KpiCard
            icon={Wallet}
            title={t("dashboard.totalDebt")}
            value={formatVND(stats.total_debt)}
            accent="amber"
            testId="kpi-debt"
            to="/debts"
          />
        )}
        {canSeeProducts && (
          <KpiCard
            icon={Package}
            title={t("dashboard.totalProducts")}
            value={stats.total_products}
            accent="blue"
            testId="kpi-products"
            to="/products"
          />
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canSeeRevenue && (
          <Card className="lg:col-span-2" data-testid="dashboard-revenue-chart">
            <CardHeader>
              <CardTitle>{t("dashboard.revenueChart")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.chart_7days} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EAE5D9" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#71717A"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${v / 1000}k`)}
                    />
                    <Tooltip
                      contentStyle={{ background: "white", border: "1px solid #E4E4E7", borderRadius: 8, fontSize: 12 }}
                      formatter={(v, n) => [n === "revenue" ? formatVND(v) : v, n === "revenue" ? t("dashboard.todayRevenue") : t("dashboard.todayOrders")]}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2D4A22"
                      strokeWidth={2.5}
                      dot={{ fill: "#2D4A22", r: 4 }}
                      activeDot={{ r: 6, fill: "#D95D39" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {canSeeProducts && (
          <Card data-testid="dashboard-top-products" className={!canSeeRevenue ? "lg:col-span-3" : ""}>
            <CardHeader>
              <CardTitle>{t("dashboard.topProducts")}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.top_products.length === 0 ? (
                <div className="text-sm text-ink-muted text-center py-6">{t("common.empty")}</div>
              ) : (
                <div className="space-y-3">
                  {stats.top_products.map((p, i) => (
                    <div key={p.product_id} className="flex items-center gap-3" data-testid={`top-product-${i}`}>
                      <div className="w-7 h-7 rounded-md bg-cream flex items-center justify-center text-xs font-bold text-bamboo">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-ink truncate">{p.name}</div>
                        <div className="text-xs text-ink-muted">
                          {t("dashboard.sold")}: {p.quantity}
                        </div>
                      </div>
                      <div className="text-xs font-mono text-bamboo font-medium">{formatVND(p.revenue)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canSeeProducts && (
          <Card data-testid="dashboard-low-stock">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("dashboard.lowStock")}</CardTitle>
                <AlertTriangle size={16} className="text-terracotta" />
              </div>
            </CardHeader>
            <CardContent className="!p-0">
              {stats.low_stock_products.length === 0 ? (
                <div className="text-sm text-ink-muted text-center py-8">
                  {lang === "vi" ? "Không có cảnh báo nào" : "No alerts"}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {stats.low_stock_products.map((p) => (
                    <li key={p.product_id} className="flex items-center justify-between px-5 py-3" data-testid={`low-stock-${p.product_id}`}>
                      <div>
                        <div className="text-sm font-medium text-ink">{p.name}</div>
                        <div className="text-xs text-ink-muted">
                          {t("dashboard.inStock")}: {p.stock} {p.unit}
                        </div>
                      </div>
                      <Badge variant={p.stock === 0 ? "cancelled" : "lowstock"}>
                        {p.stock === 0 ? t("reports.outOfStock") : `≤ ${p.low_stock_threshold}`}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {canSeeOrders && (
          <Card className={canSeeProducts ? "lg:col-span-2" : "lg:col-span-3"} data-testid="dashboard-recent-orders">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("dashboard.recentOrders")}</CardTitle>
                <Link to="/orders" className="text-xs text-bamboo hover:underline flex items-center gap-1">
                  {lang === "vi" ? "Xem tất cả" : "View all"}
                  <ArrowRight size={12} />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="!p-0">
              {stats.recent_orders.length === 0 ? (
                <div className="text-sm text-ink-muted text-center py-8">{t("common.empty")}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
                      <tr>
                        <th className="text-left py-2.5 px-4">{t("orders.code")}</th>
                        <th className="text-left py-2.5 px-4">{t("orders.customer")}</th>
                        <th className="text-right py-2.5 px-4">{t("orders.total")}</th>
                        <th className="text-center py-2.5 px-4">{t("common.status")}</th>
                        <th className="text-right py-2.5 px-4">{t("orders.date")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recent_orders.map((o) => (
                        <tr key={o.order_id} className="border-t border-border hover:bg-cream/30" data-testid={`recent-order-${o.order_id}`}>
                          <td className="py-2.5 px-4 font-mono text-xs">{o.order_code}</td>
                          <td className="py-2.5 px-4">{o.customer_name}</td>
                          <td className="py-2.5 px-4 text-right font-medium">{formatVND(o.total)}</td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge variant={o.status}>{t(`status.${o.status}`)}</Badge>
                          </td>
                          <td className="py-2.5 px-4 text-right text-xs text-ink-muted">
                            {timeAgo(o.created_at, lang)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
