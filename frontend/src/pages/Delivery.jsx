import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bike, MapPin, Phone, Printer } from "lucide-react";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Select, Label } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { toast } from "../components/ui/Toast";
import { useI18n } from "../contexts/I18nContext";
import { formatVND, formatDateTime } from "../lib/utils";
import { cn } from "../lib/utils";

const SHIFTS = [
  { id: "morning", label: "Sáng (6h-11h)", hours: [6, 11] },
  { id: "noon", label: "Trưa (11h-14h)", hours: [11, 14] },
  { id: "afternoon", label: "Chiều (14h-17h)", hours: [14, 17] },
  { id: "evening", label: "Tối (17h-22h)", hours: [17, 22] },
];

export default function Delivery() {
  const { t } = useI18n();
  const [orders, setOrders] = useState([]);
  const [shippers, setShippers] = useState([]);
  const [filterShipper, setFilterShipper] = useState("");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));

  const load = async () => {
    const [o, s] = await Promise.all([
      api.get("/orders", { params: { status: "delivering", date_from: filterDate, date_to: filterDate } }),
      api.get("/users/shippers"),
    ]);
    setOrders(o.data);
    setShippers(s.data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterDate]);

  const assignShipper = async (orderId, shipperId) => {
    try {
      await api.put(`/orders/${orderId}/assign-shipper?shipper_id=${shipperId}`);
      toast({ title: "Đã phân công", variant: "success" });
      load();
    } catch (e) {
      toast({ title: e?.response?.data?.detail || "Lỗi", variant: "error" });
    }
  };

  // Group orders by shift + shipper
  const grouped = SHIFTS.map((shift) => {
    const shiftOrders = orders.filter((o) => {
      const h = new Date(o.created_at).getHours();
      return h >= shift.hours[0] && h < shift.hours[1];
    });
    const byShipper = {};
    shiftOrders.forEach((o) => {
      const sid = o.assigned_shipper_id || "unassigned";
      if (!byShipper[sid]) byShipper[sid] = [];
      byShipper[sid].push(o);
    });
    return { ...shift, orders: shiftOrders, byShipper };
  });

  const filterByShipperOrders = (list) =>
    filterShipper ? list.filter((o) => o.assigned_shipper_id === filterShipper) : list;

  const totalToday = orders.length;
  const assignedToday = orders.filter((o) => o.assigned_shipper_id).length;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="delivery-page">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight flex items-center gap-2">
          <Bike size={28} className="text-bamboo" /> {t("delivery.title")}
        </h1>
        <p className="text-sm text-ink-secondary mt-1">
          {totalToday} đơn cần giao · {assignedToday} đã phân công · {totalToday - assignedToday} chưa phân
        </p>
      </div>

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Ngày</Label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-white border border-border rounded-md"
                data-testid="delivery-date"
              />
            </div>
            <div>
              <Label>Lọc theo shipper</Label>
              <Select value={filterShipper} onChange={(e) => setFilterShipper(e.target.value)} data-testid="delivery-shipper-filter">
                <option value="">{t("common.all")}</option>
                {shippers.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {grouped.map((g) => (
        <Card key={g.id} data-testid={`shift-${g.id}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">{g.label}</CardTitle>
              <span className="text-xs text-ink-muted">{g.orders.length} đơn</span>
            </div>
          </CardHeader>
          <CardContent className="!p-0">
            {filterByShipperOrders(g.orders).length === 0 ? (
              <div className="py-8 text-center text-sm text-ink-muted">Không có đơn ca này</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-cream/40 text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="text-left py-2.5 px-4">Mã</th>
                    <th className="text-left py-2.5 px-4">Khách</th>
                    <th className="text-left py-2.5 px-4">Khu vực</th>
                    <th className="text-right py-2.5 px-4">Tổng</th>
                    <th className="text-left py-2.5 px-4">Shipper</th>
                    <th className="text-left py-2.5 px-4">Giờ tạo</th>
                    <th className="py-2.5 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filterByShipperOrders(g.orders).map((o) => (
                    <tr key={o.order_id} className="border-t border-border" data-testid={`delivery-row-${o.order_id}`}>
                      <td className="py-2.5 px-4 font-mono text-xs">{o.order_code}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium">{o.customer_name}</div>
                        {o.customer_phone && (
                          <a href={`tel:${o.customer_phone}`} className="text-xs text-bamboo hover:underline flex items-center gap-1">
                            <Phone size={10} /> {o.customer_phone}
                          </a>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        <div className="flex items-center gap-1">
                          <MapPin size={10} className="text-ink-muted shrink-0" />
                          {o.customer_district || "—"}
                        </div>
                        <div className="text-[10px] text-ink-muted">{o.customer_address}</div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">{formatVND(o.total)}</td>
                      <td className="py-2.5 px-4">
                        <Select
                          value={o.assigned_shipper_id || ""}
                          onChange={(e) => assignShipper(o.order_id, e.target.value)}
                          className="h-8 text-xs min-w-[120px]"
                          data-testid={`delivery-assign-${o.order_id}`}
                        >
                          <option value="">— Chưa phân —</option>
                          {shippers.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
                        </Select>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-ink-muted">{formatDateTime(o.created_at)}</td>
                      <td className="py-2.5 px-4 text-right">
                        <Link to={`/orders/${o.order_id}`}>
                          <Button variant="ghost" size="sm" data-testid={`delivery-view-${o.order_id}`}>
                            <Printer size={14} />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
