import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatVND } from "../../lib/utils";

/**
 * VietQR-style payload for VietQR. Using simple QR with bank+account+amount payload.
 * Format reference: https://vietqr.io/danh-sach-api
 * For simplicity we use the VietQR public image API: https://img.vietqr.io/image/{bank}-{account}-compact.png?amount=...
 * But to avoid external image, we encode a static text or use the bank's VietQR URL.
 */
function buildVietQRUrl(bankName, account, amount, holder, note) {
  if (!bankName || !account) return null;
  // Try to detect common bank short codes for VietQR
  const map = {
    "vietcombank": "VCB", "vcb": "VCB",
    "techcombank": "TCB", "tcb": "TCB",
    "bidv": "BIDV",
    "vietinbank": "ICB", "icb": "ICB",
    "agribank": "VBA", "vba": "VBA",
    "mbbank": "MB", "mb": "MB",
    "acb": "ACB",
    "tpbank": "TPB", "tpb": "TPB",
    "vpbank": "VPB", "vpb": "VPB",
    "sacombank": "STB", "stb": "STB",
    "hdbank": "HDB", "hdb": "HDB",
    "ocb": "OCB",
    "msb": "MSB",
    "shb": "SHB",
    "vib": "VIB",
    "lpbank": "LPB", "lpb": "LPB",
    "eximbank": "EIB", "eib": "EIB",
  };
  const low = (bankName || "").toLowerCase().replace(/\s+/g, "");
  const code = map[low] || bankName.replace(/\s+/g, "").toUpperCase();
  const amt = amount ? `&amount=${Math.round(amount)}` : "";
  const addInfo = note ? `&addInfo=${encodeURIComponent(note)}` : "";
  const acc = holder ? `&accountName=${encodeURIComponent(holder)}` : "";
  return `https://img.vietqr.io/image/${code}-${account}-compact2.png?${amt.slice(1)}${addInfo}${acc}`;
}

function VietQRImage({ shop, amount, note, size = 140 }) {
  const url = buildVietQRUrl(shop.bank_name, shop.bank_account, amount, shop.bank_account_holder, note);
  if (!url) return null;
  return (
    <img
      src={url}
      alt="QR thanh toán"
      crossOrigin="anonymous"
      style={{ width: size, height: size, objectFit: "contain", border: "1px solid #E4E4E7", padding: 2, background: "#fff" }}
    />
  );
}

function ShopHeader({ shop, variant = "a4" }) {
  const big = variant === "a4" || variant === "a5";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: big ? 16 : 6 }}>
      {shop.bill_show_logo && shop.logo_url && (
        <img src={shop.logo_url} alt="" style={{ width: big ? 56 : 36, height: big ? 56 : 36, objectFit: "contain" }} />
      )}
      <div>
        <div style={{ fontSize: big ? 22 : 13, fontWeight: 800, color: "#2D4A22" }}>{shop.shop_name}</div>
        <div style={{ fontSize: big ? 11 : 9, color: "#52525B", lineHeight: 1.4 }}>
          {shop.bill_show_address && shop.address ? <div>{shop.address}</div> : null}
          {shop.bill_show_phone && shop.phone ? <span>ĐT: {shop.phone} </span> : null}
          {shop.bill_show_email && shop.email ? <span>· {shop.email} </span> : null}
          {shop.bill_show_website && shop.website ? <span>· {shop.website}</span> : null}
          {shop.bill_show_tax_id && shop.tax_id ? <div>MST: {shop.tax_id}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** 80mm thermal — minimal, just customer info + items + totals + dates + optional QR */
export function BillThermal({ order, shop }) {
  if (!order) return null;
  shop = shop || {};
  const purchaseDate = new Date(order.created_at);
  const printDate = new Date();

  return (
    <div className="thermal-80mm" style={{ padding: "4mm" }}>
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        {shop.bill_show_logo && shop.logo_url && (
          <img src={shop.logo_url} alt="" style={{ width: 40, height: 40, objectFit: "contain", marginBottom: 4 }} />
        )}
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>
          {shop.shop_name || "Tiệm Bánh Bao"}
        </div>
        {shop.bill_show_address && shop.address ? <div style={{ fontSize: 9 }}>{shop.address}</div> : null}
        {shop.bill_show_phone && shop.phone ? <div style={{ fontSize: 9 }}>ĐT: {shop.phone}</div> : null}
        <div style={{ fontSize: 10, marginTop: 4 }}>HÓA ĐƠN BÁN HÀNG</div>
      </div>

      <div className="divider" />

      <div>
        <div className="row"><span>Mã đơn:</span><strong>{order.order_code}</strong></div>
        <div className="row"><span>Khách:</span><strong style={{ maxWidth: "60%", textAlign: "right" }}>{order.customer_name}</strong></div>
        {order.customer_phone && <div className="row"><span>SĐT:</span><span>{order.customer_phone}</span></div>}
        {order.customer_address && <div style={{ marginTop: 2 }}>ĐC: {order.customer_address}</div>}
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
              <tr><td colSpan={3} style={{ paddingTop: 3, fontWeight: 600 }}>{it.name}</td></tr>
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

      <div className="row"><span>Tạm tính</span><span>{formatVND(order.subtotal)}</span></div>
      {(order.discount > 0 || order.discount_percent > 0) && (
        <div className="row">
          <span>Giảm{order.discount_percent > 0 ? ` (${order.discount_percent}%)` : ""}</span>
          <span>- {formatVND(order.discount_amount || order.discount)}</span>
        </div>
      )}
      {order.shipping_fee > 0 && <div className="row"><span>Phí ship</span><span>+ {formatVND(order.shipping_fee)}</span></div>}
      <div className="divider" />
      <div className="row" style={{ fontSize: 13, fontWeight: 700 }}>
        <span>TỔNG</span><span>{formatVND(order.total)}</span>
      </div>

      <div className="divider" />

      <div style={{ fontSize: 9, lineHeight: 1.4 }}>
        <div>Ngày mua: {purchaseDate.toLocaleString("vi-VN")}</div>
        <div>Ngày in: {printDate.toLocaleString("vi-VN")}</div>
      </div>

      {shop.bill_show_bank_qr && shop.bank_account && shop.bank_name && (
        <>
          <div className="divider" />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 4 }}>QUÉT QR ĐỂ THANH TOÁN</div>
            <VietQRImage shop={shop} amount={order.total} note={order.order_code} size={120} />
            <div style={{ fontSize: 9, marginTop: 4 }}>{shop.bank_name} · {shop.bank_account}</div>
            {shop.bank_account_holder && <div style={{ fontSize: 9 }}>{shop.bank_account_holder}</div>}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 8, fontSize: 10, fontStyle: "italic" }}>
        — {shop.bill_footer_text || "Cảm ơn quý khách"} —
      </div>
    </div>
  );
}

/** A4 portrait invoice */
export function InvoiceA4({ order, shop }) {
  if (!order) return null;
  shop = shop || {};
  const purchaseDate = new Date(order.created_at);
  const printDate = new Date();

  return (
    <div className="invoice-a4" style={{ padding: "14mm" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <ShopHeader shop={shop} variant="a4" />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>HÓA ĐƠN</div>
          <div style={{ fontSize: 12, fontFamily: "monospace", marginTop: 4 }}>{order.order_code}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20, fontSize: 12 }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#71717A", marginBottom: 4 }}>Khách hàng</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{order.customer_name}</div>
          {order.customer_phone && <div>{order.customer_phone}</div>}
          {order.customer_address && <div>{order.customer_address}</div>}
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#71717A", marginBottom: 4 }}>Thông tin</div>
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
              <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{formatVND(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
        {shop.bill_show_bank_qr && shop.bank_account && shop.bank_name && (
          <div style={{ textAlign: "center", paddingTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#71717A", marginBottom: 6 }}>
              Quét QR để thanh toán
            </div>
            <VietQRImage shop={shop} amount={order.total} note={order.order_code} size={140} />
            <div style={{ fontSize: 10, marginTop: 6 }}>{shop.bank_name} · {shop.bank_account}</div>
            {shop.bank_account_holder && <div style={{ fontSize: 10 }}>{shop.bank_account_holder}</div>}
          </div>
        )}

        <div style={{ marginLeft: "auto", width: "55%", fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ color: "#52525B" }}>Tạm tính</span>
            <span style={{ fontFamily: "monospace" }}>{formatVND(order.subtotal)}</span>
          </div>
          {(order.discount > 0 || order.discount_percent > 0) && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span style={{ color: "#52525B" }}>Giảm giá{order.discount_percent > 0 ? ` (${order.discount_percent}%)` : ""}</span>
              <span style={{ fontFamily: "monospace" }}>- {formatVND(order.discount_amount || order.discount)}</span>
            </div>
          )}
          {order.shipping_fee > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span style={{ color: "#52525B" }}>Phí vận chuyển</span>
              <span style={{ fontFamily: "monospace" }}>+ {formatVND(order.shipping_fee)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px", borderTop: "2px solid #2D4A22", marginTop: 6, fontSize: 16, fontWeight: 700 }}>
            <span>TỔNG CỘNG</span>
            <span style={{ color: "#2D4A22", fontFamily: "monospace" }}>{formatVND(order.total)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 40, textAlign: "center", fontSize: 11, fontStyle: "italic", color: "#71717A" }}>
        {shop.bill_footer_text || "Cảm ơn quý khách. Hẹn gặp lại!"}
      </div>
    </div>
  );
}

/** A5 landscape — 210mm x 148mm */
export function InvoiceA5Landscape({ order, shop }) {
  if (!order) return null;
  shop = shop || {};
  const purchaseDate = new Date(order.created_at);
  const printDate = new Date();

  return (
    <div style={{
      background: "#fff", color: "#000",
      width: "210mm", height: "148mm",
      padding: "8mm",
      fontFamily: "'IBM Plex Sans', sans-serif",
      fontSize: 10,
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, paddingBottom: 6, borderBottom: "2px solid #2D4A22" }}>
        <ShopHeader shop={shop} variant="a5" />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>HÓA ĐƠN</div>
          <div style={{ fontSize: 10, fontFamily: "monospace" }}>{order.order_code}</div>
          <div style={{ fontSize: 9, color: "#71717A" }}>{purchaseDate.toLocaleString("vi-VN")}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8, fontSize: 10 }}>
        <div>
          <div style={{ fontSize: 8, textTransform: "uppercase", color: "#71717A" }}>Khách hàng</div>
          <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
          {order.customer_phone && <div>{order.customer_phone}</div>}
          {order.customer_address && <div style={{ fontSize: 9 }}>{order.customer_address}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 8, textTransform: "uppercase", color: "#71717A" }}>Ngày in</div>
          <div>{printDate.toLocaleString("vi-VN")}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr style={{ background: "#F4F1EA", textTransform: "uppercase", fontSize: 8, color: "#52525B" }}>
                <th style={{ padding: "5px 4px", textAlign: "left" }}>Tên hàng</th>
                <th style={{ padding: "5px 4px", textAlign: "right", width: "20%" }}>Đơn giá</th>
                <th style={{ padding: "5px 4px", textAlign: "center", width: "10%" }}>SL</th>
                <th style={{ padding: "5px 4px", textAlign: "right", width: "20%" }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #E4E4E7" }}>
                  <td style={{ padding: "5px 4px" }}>{it.name}</td>
                  <td style={{ padding: "5px 4px", textAlign: "right", fontFamily: "monospace" }}>{formatVND(it.price)}</td>
                  <td style={{ padding: "5px 4px", textAlign: "center" }}>{it.quantity}</td>
                  <td style={{ padding: "5px 4px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{formatVND(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 6, marginLeft: "auto", width: "60%", fontSize: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span style={{ color: "#52525B" }}>Tạm tính</span>
              <span style={{ fontFamily: "monospace" }}>{formatVND(order.subtotal)}</span>
            </div>
            {(order.discount > 0 || order.discount_percent > 0) && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span style={{ color: "#52525B" }}>Giảm{order.discount_percent > 0 ? ` (${order.discount_percent}%)` : ""}</span>
                <span style={{ fontFamily: "monospace" }}>- {formatVND(order.discount_amount || order.discount)}</span>
              </div>
            )}
            {order.shipping_fee > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span style={{ color: "#52525B" }}>Phí ship</span>
                <span style={{ fontFamily: "monospace" }}>+ {formatVND(order.shipping_fee)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0 2px", borderTop: "2px solid #2D4A22", marginTop: 4, fontSize: 13, fontWeight: 700 }}>
              <span>TỔNG</span>
              <span style={{ color: "#2D4A22", fontFamily: "monospace" }}>{formatVND(order.total)}</span>
            </div>
          </div>
        </div>

        {shop.bill_show_bank_qr && shop.bank_account && shop.bank_name && (
          <div style={{ textAlign: "center", paddingTop: 4, minWidth: 110 }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", color: "#71717A", marginBottom: 4 }}>
              QR Thanh toán
            </div>
            <VietQRImage shop={shop} amount={order.total} note={order.order_code} size={100} />
            <div style={{ fontSize: 8, marginTop: 4 }}>{shop.bank_name}</div>
            <div style={{ fontSize: 8, fontFamily: "monospace" }}>{shop.bank_account}</div>
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 6, fontSize: 9, fontStyle: "italic", color: "#71717A", paddingTop: 6, borderTop: "1px solid #E4E4E7" }}>
        {shop.bill_footer_text || "Cảm ơn quý khách"}
      </div>
    </div>
  );
}
