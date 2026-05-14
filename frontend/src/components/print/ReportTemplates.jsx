import React from "react";
import { formatVND, formatDate } from "../../lib/utils";

const HEADER_STYLE = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: "2px solid #2D4A22",
  paddingBottom: 12,
  marginBottom: 20,
};

const TH = { padding: "8px 6px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "#52525B", background: "#F4F1EA" };
const TD = { padding: "8px 6px", borderBottom: "1px solid #E4E4E7", fontSize: 11 };

function Container({ title, subtitle, children }) {
  return (
    <div className="invoice-a4">
      <div style={HEADER_STYLE}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#2D4A22" }}>Tiệm Bánh Bao</div>
          <div style={{ fontSize: 11, color: "#52525B", marginTop: 2 }}>Báo cáo nội bộ — Bánh Bao Admin</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.5 }}>{title}</div>
          <div style={{ fontSize: 10, color: "#71717A", marginTop: 2 }}>{subtitle}</div>
          <div style={{ fontSize: 10, color: "#71717A" }}>In: {new Date().toLocaleString("vi-VN")}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Revenue report print template */
export function RevenueReportPrint({ data = [], period = "daily", dateFrom, dateTo }) {
  const total = data.reduce((s, d) => s + (d.revenue || 0), 0);
  const totalOrders = data.reduce((s, d) => s + (d.orders || 0), 0);
  const range = dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : { daily: "30 ngày gần nhất", weekly: "12 tuần gần nhất", monthly: "12 tháng gần nhất" }[period];

  return (
    <Container title="BÁO CÁO DOANH THU" subtitle={range}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ padding: 12, background: "#F4F1EA", borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: "#71717A", textTransform: "uppercase" }}>Tổng doanh thu</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#2D4A22", marginTop: 2 }}>{formatVND(total)}</div>
        </div>
        <div style={{ padding: 12, background: "#F4F1EA", borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: "#71717A", textTransform: "uppercase" }}>Tổng đơn</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#D95D39", marginTop: 2 }}>{totalOrders}</div>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={TH}>Kỳ</th>
            <th style={{ ...TH, textAlign: "right" }}>Số đơn</th>
            <th style={{ ...TH, textAlign: "right" }}>Doanh thu</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td style={TD}>{d.label}</td>
              <td style={{ ...TD, textAlign: "right" }}>{d.orders}</td>
              <td style={{ ...TD, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{formatVND(d.revenue)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...TD, fontWeight: 700, borderTop: "2px solid #2D4A22" }}>TỔNG</td>
            <td style={{ ...TD, textAlign: "right", fontWeight: 700, borderTop: "2px solid #2D4A22" }}>{totalOrders}</td>
            <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: "#2D4A22", fontFamily: "monospace", borderTop: "2px solid #2D4A22" }}>{formatVND(total)}</td>
          </tr>
        </tbody>
      </table>
    </Container>
  );
}

/** Debt report print template */
export function DebtReportPrint({ items = [], total = 0 }) {
  return (
    <Container title="BÁO CÁO CÔNG NỢ" subtitle={`Tổng nợ: ${formatVND(total)}`}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={TH}>Khách hàng</th>
            <th style={TH}>SĐT</th>
            <th style={{ ...TH, textAlign: "right" }}>Số đơn</th>
            <th style={{ ...TH, textAlign: "right" }}>Đơn gần nhất</th>
            <th style={{ ...TH, textAlign: "right" }}>Nợ</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={5} style={{ ...TD, textAlign: "center", color: "#71717A" }}>Không có công nợ</td></tr>
          ) : items.map((d, i) => (
            <tr key={i}>
              <td style={{ ...TD, fontWeight: 600 }}>{d.customer_name}</td>
              <td style={TD}>{d.phone}</td>
              <td style={{ ...TD, textAlign: "right" }}>{d.orders}</td>
              <td style={{ ...TD, textAlign: "right" }}>{formatDate(d.last_order)}</td>
              <td style={{ ...TD, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: "#D95D39" }}>{formatVND(d.debt)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={{ ...TD, fontWeight: 700, borderTop: "2px solid #2D4A22" }}>TỔNG NỢ</td>
            <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: "#D95D39", fontFamily: "monospace", borderTop: "2px solid #2D4A22" }}>{formatVND(total)}</td>
          </tr>
        </tbody>
      </table>
    </Container>
  );
}

/** Inventory report print template */
export function InventoryReportPrint({ data = {} }) {
  const products = data.products || [];
  const negative = data.negative_stock_products || [];

  return (
    <Container
      title="BÁO CÁO TỒN KHO"
      subtitle={`Tổng sản phẩm: ${data.total_products || 0} · Hết hàng: ${data.out_of_stock_count || 0} · Tồn thấp: ${data.low_stock_count || 0} · Âm hàng: ${data.negative_stock_count || 0}`}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
        <div style={{ padding: 10, background: "#F4F1EA", borderRadius: 6 }}>
          <div style={{ fontSize: 9, color: "#71717A", textTransform: "uppercase" }}>Tổng giá trị</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#2D4A22", marginTop: 2 }}>{formatVND(data.total_stock_value || 0)}</div>
        </div>
        <div style={{ padding: 10, background: "#FEF3C7", borderRadius: 6 }}>
          <div style={{ fontSize: 9, color: "#71717A", textTransform: "uppercase" }}>Tồn thấp</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#B45309", marginTop: 2 }}>{data.low_stock_count || 0}</div>
        </div>
        <div style={{ padding: 10, background: "#FEE2E2", borderRadius: 6 }}>
          <div style={{ fontSize: 9, color: "#71717A", textTransform: "uppercase" }}>Hết hàng</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#B91C1C", marginTop: 2 }}>{data.out_of_stock_count || 0}</div>
        </div>
        <div style={{ padding: 10, background: "#FEE2E2", borderRadius: 6, border: "1px solid #FECACA" }}>
          <div style={{ fontSize: 9, color: "#71717A", textTransform: "uppercase" }}>Âm hàng</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#7F1D1D", marginTop: 2 }}>{data.negative_stock_count || 0}</div>
        </div>
      </div>

      {negative.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#7F1D1D" }}>
            ⚠ Hàng bị âm (cần kiểm tra)
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={TH}>Tên hàng</th>
                <th style={TH}>Danh mục</th>
                <th style={{ ...TH, textAlign: "right" }}>Tồn</th>
              </tr>
            </thead>
            <tbody>
              {negative.map((p) => (
                <tr key={p.product_id}>
                  <td style={{ ...TD, fontWeight: 600 }}>{p.name}</td>
                  <td style={TD}>{p.category}</td>
                  <td style={{ ...TD, textAlign: "right", color: "#7F1D1D", fontWeight: 700 }}>{p.stock} {p.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Danh sách sản phẩm</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={TH}>Tên hàng</th>
            <th style={TH}>Danh mục</th>
            <th style={{ ...TH, textAlign: "right" }}>Tồn</th>
            <th style={{ ...TH, textAlign: "right" }}>Giá vốn</th>
            <th style={{ ...TH, textAlign: "right" }}>Giá trị</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.product_id}>
              <td style={{ ...TD, fontWeight: 600 }}>{p.name}</td>
              <td style={TD}>{p.category}</td>
              <td style={{ ...TD, textAlign: "right" }}>{p.stock} {p.unit}</td>
              <td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{formatVND(p.cost)}</td>
              <td style={{ ...TD, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                {formatVND((p.stock || 0) * (p.cost || 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Container>
  );
}

/** Orders list print template */
export function OrdersListPrint({ orders = [], filterLabel = "" }) {
  const total = orders.reduce((s, o) => s + (o.total || 0), 0);
  const STATUS_VI = {
    preparing: "Đang chuẩn bị",
    delivering: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy",
  };

  return (
    <Container title="DANH SÁCH ĐƠN HÀNG" subtitle={`${orders.length} đơn · ${filterLabel || "Tất cả"}`}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={TH}>Mã đơn</th>
            <th style={TH}>Khách hàng</th>
            <th style={TH}>Trạng thái</th>
            <th style={TH}>Ngày đặt</th>
            <th style={{ ...TH, textAlign: "right" }}>Tổng</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr><td colSpan={5} style={{ ...TD, textAlign: "center", color: "#71717A" }}>Không có đơn nào</td></tr>
          ) : orders.map((o) => (
            <tr key={o.order_id}>
              <td style={{ ...TD, fontFamily: "monospace", fontSize: 10 }}>{o.order_code}</td>
              <td style={TD}>
                <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                <div style={{ fontSize: 9, color: "#71717A" }}>{o.customer_phone}</div>
              </td>
              <td style={TD}>{STATUS_VI[o.status] || o.status}</td>
              <td style={TD}>{new Date(o.created_at).toLocaleString("vi-VN")}</td>
              <td style={{ ...TD, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{formatVND(o.total)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={{ ...TD, fontWeight: 700, borderTop: "2px solid #2D4A22" }}>TỔNG DOANH THU</td>
            <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: "#2D4A22", fontFamily: "monospace", borderTop: "2px solid #2D4A22" }}>
              {formatVND(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </Container>
  );
}
