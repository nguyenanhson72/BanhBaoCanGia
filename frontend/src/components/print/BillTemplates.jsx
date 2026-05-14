import React from "react";
import { formatVND } from "../../lib/utils";

/** 80mm thermal bill — minimal: customer info + items + totals + dates */
export function BillThermal({ order, shopName = "Tiệm Bánh Bao" }) {
  if (!order) return null;
  const purchaseDate = new Date(order.created_at);
  const printDate = new Date();

  return (
    <div className="thermal-80mm" style={{ padding: "4mm" }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>
          {shopName}
        </div>
        <div style={{ fontSize: 10 }}>HÓA ĐƠN BÁN HÀNG</div>
      </div>

      <div className="divider" />

      <div>
        <div className="row">
          <span>Mã đơn:</span>
          <strong>{order.order_code}</strong>
        </div>
        <div className="row">
          <span>Khách:</span>
          <strong style={{ maxWidth: "60%", textAlign: "right" }}>
            {order.customer_name}
          </strong>
        </div>
        {order.customer_phone && (
          <div className="row">
            <span>SĐT:</span>
            <span>{order.customer_phone}</span>
          </div>
        )}
        {order.customer_address && (
          <div style={{ marginTop: 2 }}>
            ĐC: {order.customer_address}
          </div>
        )}
      </div>

      <div className="divider" />

      <table style={{ width: "100%", fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Tên hàng</th>
            <th style={{ textAlign: "center", width: "12mm" }}>SL</th>
            <th style={{ textAlign: "right", width: "22mm" }}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <React.Fragment key={i}>
              <tr>
                <td colSpan={3} style={{ paddingTop: 3, fontWeight: 600 }}>{it.name}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 4 }}>{formatVND(it.price)}</td>
                <td style={{ textAlign: "center" }}>{it.quantity}</td>
                <td style={{ textAlign: "right" }}>{formatVND(it.subtotal)}</td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <div className="divider" />

      <div className="row">
        <span>Tạm tính</span>
        <span>{formatVND(order.subtotal)}</span>
      </div>
      {(order.discount > 0 || order.discount_percent > 0) && (
        <div className="row">
          <span>
            Giảm giá
            {order.discount_percent > 0 ? ` (${order.discount_percent}%)` : ""}
          </span>
          <span>- {formatVND(order.discount_amount || order.discount)}</span>
        </div>
      )}
      {order.shipping_fee > 0 && (
        <div className="row">
          <span>Phí ship</span>
          <span>+ {formatVND(order.shipping_fee)}</span>
        </div>
      )}
      <div className="divider" />
      <div className="row" style={{ fontSize: 13, fontWeight: 700 }}>
        <span>TỔNG</span>
        <span>{formatVND(order.total)}</span>
      </div>

      <div className="divider" />

      <div style={{ fontSize: 9, lineHeight: 1.4 }}>
        <div>Ngày mua: {purchaseDate.toLocaleString("vi-VN")}</div>
        <div>Ngày in: {printDate.toLocaleString("vi-VN")}</div>
      </div>

      <div style={{ textAlign: "center", marginTop: 10, fontSize: 10, fontStyle: "italic" }}>
        — Cảm ơn quý khách —
      </div>
    </div>
  );
}

/** A4 invoice — minimal: header + customer + items + totals + dates */
export function InvoiceA4({ order, shopName = "Tiệm Bánh Bao", shopInfo = {} }) {
  if (!order) return null;
  const purchaseDate = new Date(order.created_at);
  const printDate = new Date();

  return (
    <div className="invoice-a4">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#2D4A22" }}>{shopName}</div>
          <div style={{ fontSize: 11, color: "#52525B", marginTop: 4 }}>
            {shopInfo.address || ""} {shopInfo.phone ? `· ${shopInfo.phone}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>HÓA ĐƠN</div>
          <div style={{ fontSize: 12, fontFamily: "monospace", marginTop: 4 }}>{order.order_code}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20, fontSize: 12 }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#71717A", marginBottom: 4 }}>
            Khách hàng
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{order.customer_name}</div>
          {order.customer_phone && <div>{order.customer_phone}</div>}
          {order.customer_address && <div>{order.customer_address}</div>}
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#71717A", marginBottom: 4 }}>
            Thông tin
          </div>
          <div>Ngày mua: <strong>{purchaseDate.toLocaleDateString("vi-VN")}</strong></div>
          <div>Giờ mua: {purchaseDate.toLocaleTimeString("vi-VN")}</div>
          <div>Ngày in: {printDate.toLocaleString("vi-VN")}</div>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#F4F1EA", color: "#52525B", textTransform: "uppercase", fontSize: 10, letterSpacing: 0.5 }}>
            <th style={{ padding: "10px 8px", textAlign: "left" }}>Tên hàng</th>
            <th style={{ padding: "10px 8px", textAlign: "right", width: "20%" }}>Đơn giá</th>
            <th style={{ padding: "10px 8px", textAlign: "center", width: "12%" }}>SL</th>
            <th style={{ padding: "10px 8px", textAlign: "right", width: "20%" }}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #E4E4E7" }}>
              <td style={{ padding: "10px 8px" }}>{it.name}</td>
              <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace" }}>{formatVND(it.price)}</td>
              <td style={{ padding: "10px 8px", textAlign: "center" }}>{it.quantity}</td>
              <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                {formatVND(it.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginLeft: "auto", width: "60%", fontSize: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
          <span style={{ color: "#52525B" }}>Tạm tính</span>
          <span style={{ fontFamily: "monospace" }}>{formatVND(order.subtotal)}</span>
        </div>
        {(order.discount > 0 || order.discount_percent > 0) && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ color: "#52525B" }}>
              Giảm giá{order.discount_percent > 0 ? ` (${order.discount_percent}%)` : ""}
            </span>
            <span style={{ fontFamily: "monospace" }}>- {formatVND(order.discount_amount || order.discount)}</span>
          </div>
        )}
        {order.shipping_fee > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ color: "#52525B" }}>Phí vận chuyển</span>
            <span style={{ fontFamily: "monospace" }}>+ {formatVND(order.shipping_fee)}</span>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 0 4px",
            borderTop: "2px solid #2D4A22",
            marginTop: 6,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          <span>TỔNG CỘNG</span>
          <span style={{ color: "#2D4A22", fontFamily: "monospace" }}>{formatVND(order.total)}</span>
        </div>
      </div>

      <div style={{ marginTop: 40, textAlign: "center", fontSize: 11, fontStyle: "italic", color: "#71717A" }}>
        Cảm ơn quý khách. Hẹn gặp lại!
      </div>
    </div>
  );
}
