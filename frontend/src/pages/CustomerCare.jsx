import React, { useEffect, useState } from "react";
import { HeartHandshake, Phone, Calendar, Search } from "lucide-react";
import api from "../lib/api";
import { Card, CardContent } from "../components/ui/Card";
import { Input, Select, Label } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useI18n } from "../contexts/I18nContext";
import { formatVND, formatDate, timeAgo } from "../lib/utils";
import { cn } from "../lib/utils";

export default function CustomerCare() {
  const { t, lang } = useI18n();
  const [days, setDays] = useState(14);
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("");
  const [data, setData] = useState(null);

  const load = async () => {
    const { data } = await api.get(`/customers/care?days=${days}`);
    setData(data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const filtered = (data?.items || []).filter((c) => {
    if (q) {
      const s = q.toLowerCase();
      if (!`${c.name || ""} ${c.phone || ""} ${c.nickname || ""}`.toLowerCase().includes(s)) return false;
    }
    if (district && c.district !== district) return false;
    return true;
  });

  const districts = Array.from(new Set((data?.items || []).map((c) => c.district).filter(Boolean)));

  return (
    <div className="space-y-6 animate-fade-in" data-testid="customer-care-page">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <HeartHandshake size={28} className="text-terracotta" /> {t("customers.careTitle")}
        </h1>
        <p className="text-sm text-ink-secondary mt-1">
          Khách đã đặt được đẩy lên đầu. Khách chưa đặt trong {days}+ ngày sẽ hiển thị xuống dưới.
        </p>
      </div>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent>
              <div className="text-xs uppercase tracking-wider text-ink-muted">Tổng khách</div>
              <div className="font-heading text-2xl font-bold mt-1">{data.total}</div>
            </CardContent>
          </Card>
          <Card className="border-amber-200">
            <CardContent>
              <div className="text-xs uppercase tracking-wider text-amber-700">Cần chăm sóc</div>
              <div className="font-heading text-2xl font-bold mt-1 text-amber-700">{data.needs_care_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="text-xs uppercase tracking-wider text-ink-muted">Đã đặt gần đây</div>
              <div className="font-heading text-2xl font-bold mt-1 text-emerald-700">{data.total - data.needs_care_count}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <Label>{t("common.search")}</Label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" placeholder="Tên / SĐT" data-testid="care-search" />
              </div>
            </div>
            <div>
              <Label>{t("common.district")}</Label>
              <Select value={district} onChange={(e) => setDistrict(e.target.value)} data-testid="care-district">
                <option value="">{t("common.all")}</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
            <div>
              <Label>Chưa đặt (ngày)</Label>
              <Select value={days} onChange={(e) => setDays(Number(e.target.value))} data-testid="care-days">
                <option value={7}>7 ngày</option>
                <option value={14}>14 ngày</option>
                <option value={30}>30 ngày</option>
                <option value={60}>60 ngày</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
              <tr>
                <th className="text-left py-3 px-4">Khách hàng</th>
                <th className="text-left py-3 px-4">SĐT</th>
                <th className="text-left py-3 px-4">Khu vực</th>
                <th className="text-right py-3 px-4">Số đơn</th>
                <th className="text-right py-3 px-4">Tổng chi</th>
                <th className="text-left py-3 px-4">Đặt gần nhất</th>
                <th className="text-center py-3 px-4">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody data-testid="care-table-body">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-ink-muted">{t("common.empty")}</td></tr>
              ) : filtered.map((c) => (
                <tr key={c.customer_id} className={cn("border-t border-border hover:bg-cream/30", c.needs_care && "bg-amber-50/30")} data-testid={`care-row-${c.customer_id}`}>
                  <td className="py-3 px-4 font-medium">
                    {c.name}
                    {c.nickname && <span className="text-xs text-ink-muted ml-1">({c.nickname})</span>}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="text-bamboo hover:underline flex items-center gap-1" data-testid={`care-call-${c.customer_id}`}>
                        <Phone size={12} /> {c.phone}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="py-3 px-4 text-xs">{c.district || "—"}</td>
                  <td className="py-3 px-4 text-right">{c.order_count}</td>
                  <td className="py-3 px-4 text-right font-mono text-xs">{formatVND(c.total_spent_agg || 0)}</td>
                  <td className="py-3 px-4 text-xs text-ink-muted">
                    {c.last_order ? timeAgo(c.last_order, lang) : "Chưa đặt"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {!c.last_order ?
                      <Badge variant="cancelled">Chưa đặt</Badge> :
                      c.needs_care ?
                        <Badge variant="lowstock">Cần chăm sóc</Badge> :
                        <Badge variant="delivered">Đã đặt</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
