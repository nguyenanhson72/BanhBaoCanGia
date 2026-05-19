import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import api from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Label, Textarea } from "../components/ui/Input";
import Combobox from "../components/ui/Combobox";
import { Badge } from "../components/ui/Badge";
import { toast } from "../components/ui/Toast";
import { useI18n } from "../contexts/I18nContext";
import { formatVND } from "../lib/utils";

export default function NewOrder() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cloneFromId = searchParams.get("clone_from");
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [shippers, setShippers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerDistrict, setCustomerDistrict] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [orderType, setOrderType] = useState("retail");
  const [items, setItems] = useState([]);
  const [payment, setPayment] = useState("cash");
  const [discount, setDiscount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [shipperId, setShipperId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, p, s] = await Promise.all([
        api.get("/customers"),
        api.get("/products"),
        api.get("/users/shippers").catch(() => ({ data: [] })),
      ]);
      setCustomers(c.data);
      setProducts(p.data);
      setShippers(s.data);

      // Clone existing order's data into the form
      if (cloneFromId) {
        try {
          const { data: src } = await api.get(`/orders/${cloneFromId}`);
          setCustomerId(src.customer_id || "");
          setCustomerName(src.customer_name || "");
          setCustomerPhone(src.customer_phone || "");
          setCustomerAddress(src.customer_address || "");
          setCustomerDistrict(src.customer_district || "");
          setCustomerCity(src.customer_city || "");
          setOrderType(src.type || "retail");
          setPayment(src.payment_method || "cash");
          setDiscount(src.discount || 0);
          setDiscountPercent(src.discount_percent || 0);
          setShipping(src.shipping_fee || 0);
          setShipperId(src.assigned_shipper_id || "");
          setNote(src.note || "");
          // Re-resolve product stock from products list
          const productMap = Object.fromEntries((p.data || []).map((pp) => [pp.product_id, pp]));
          const clonedItems = (src.items || []).map((it) => {
            const product = productMap[it.product_id] || {};
            return {
              product_id: it.product_id,
              name: it.name,
              price: it.price || 0,
              quantity: it.quantity || 1,
              subtotal: (it.price || 0) * (it.quantity || 0),
              stock_left: product.stock ?? 0,
              unit: product.unit || "cái",
            };
          });
          setItems(clonedItems);
          toast({ title: `Đã sao chép từ ${src.order_code}. Bạn có thể chỉnh sửa trước khi lưu.`, variant: "success" });
        } catch (e) {
          toast({ title: e?.response?.data?.detail || "Không tải được đơn gốc", variant: "error" });
        }
      }
    })();
    /* eslint-disable-next-line */
  }, []);

  const selectCustomer = (id, c) => {
    setCustomerId(id);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone || "");
      setCustomerAddress(c.address || "");
      setCustomerDistrict(c.district || "");
      setCustomerCity(c.city || "");
      if (c.type === "wholesale") setOrderType("wholesale");
      // Auto due date based on max_debt_days
      if (c.max_debt_days > 0 && payment === "debt") {
        const d = new Date();
        d.setDate(d.getDate() + c.max_debt_days);
        setDueDate(d.toISOString().slice(0, 10));
      }
    }
  };

  const addEmptyItem = () => {
    setItems((prev) => [
      ...prev,
      { product_id: "", name: "", price: 0, quantity: 1, subtotal: 0, stock_left: 0, unit: "cái" },
    ]);
  };

  const setItemProduct = (idx, productId, product) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        product_id: productId,
        name: product?.name || "",
        price: product?.price || 0,
        stock_left: product?.stock ?? 0,
        unit: product?.unit || "cái",
      };
      next[idx].subtotal = next[idx].price * (Number(next[idx].quantity) || 0);
      return next;
    });
  };

  const setItemQty = (idx, qty) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: qty };
      next[idx].subtotal = (Number(next[idx].price) || 0) * (Number(qty) || 0);
      return next;
    });
  };

  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, it) => s + (it.subtotal || 0), 0);
  const percentDiscountAmount = Math.round(subtotal * (Number(discountPercent) || 0) / 100);
  const total = subtotal - Number(discount || 0) - percentDiscountAmount + Number(shipping || 0);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || items.length === 0 || items.some((it) => !it.product_id)) {
      toast({ title: "Vui lòng nhập khách hàng và chọn đủ sản phẩm", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customer_id: customerId || null,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        customer_district: customerDistrict,
        customer_city: customerCity,
        type: orderType,
        items: items.map((it) => ({
          product_id: it.product_id,
          name: it.name,
          price: it.price,
          quantity: Number(it.quantity) || 0,
          subtotal: it.subtotal,
        })),
        payment_method: payment,
        discount: Number(discount) || 0,
        discount_percent: Number(discountPercent) || 0,
        shipping_fee: Number(shipping) || 0,
        assigned_shipper_id: shipperId || "",
        due_date: dueDate || "",
        note,
      };
      const { data } = await api.post("/orders", payload);
      toast({ title: t("common.saved"), variant: "success" });
      navigate(`/orders/${data.order_id}`);
    } catch (err) {
      toast({ title: err?.response?.data?.detail || t("common.error"), variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 animate-fade-in" data-testid="new-order-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} type="button" data-testid="new-order-back">
            <ArrowLeft size={18} />
          </Button>
          <h1 className="font-heading text-2xl font-bold">{t("orders.new")}</h1>
        </div>
        <Button type="submit" disabled={saving} data-testid="new-order-submit">
          {saving ? t("common.loading") : t("common.save")}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("orders.customer")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t("orders.selectCustomer")}</Label>
                <Combobox
                  items={customers}
                  value={customerId}
                  onChange={selectCustomer}
                  getKey={(c) => c.customer_id}
                  getLabel={(c) => `${c.name}${c.phone ? ` — ${c.phone}` : ""}`}
                  placeholder="Gõ tên hoặc SĐT khách..."
                  searchKeys={["name", "phone", "email", "address"]}
                  testId="new-order-customer"
                  renderItem={(c) => (
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-ink-muted truncate">
                        {c.phone || "—"} {c.address ? `· ${c.address}` : ""}
                      </div>
                    </div>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>{t("common.name")} *</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required data-testid="new-order-customer-name" />
                </div>
                <div>
                  <Label>{t("common.phone")}</Label>
                  <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} data-testid="new-order-customer-phone" />
                </div>
              </div>
              <div>
                <Label>{t("common.address")}</Label>
                <Input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Tự động điền khi chọn khách"
                  data-testid="new-order-customer-address"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Phường/Xã</Label>
                  <Input
                    value={customerDistrict}
                    onChange={(e) => setCustomerDistrict(e.target.value)}
                    placeholder="VD: Phường 1"
                    data-testid="new-order-customer-district"
                  />
                </div>
                <div>
                  <Label>Tỉnh/Thành phố</Label>
                  <Input
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    placeholder="VD: TP.HCM"
                    data-testid="new-order-customer-city"
                  />
                </div>
                <div>
                  <Label>{t("orders.type")}</Label>
                  <Select value={orderType} onChange={(e) => setOrderType(e.target.value)} data-testid="new-order-type">
                    <option value="retail">{t("orders.retail")}</option>
                    <option value="wholesale">{t("orders.wholesale")}</option>
                    <option value="delivery">{t("orders.delivery")}</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("orders.items")}</CardTitle>
                <Button type="button" variant="secondary" size="sm" onClick={addEmptyItem} data-testid="new-order-add-item">
                  <Plus size={14} /> {t("orders.addItem")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center text-sm text-ink-muted py-6">{t("common.empty")}</div>
              ) : (
                <div className="space-y-4">
                  {items.map((it, i) => {
                    const lowOrOOS = it.stock_left <= 0 || it.stock_left < it.quantity;
                    return (
                      <div key={i} className="border border-border rounded-md p-3 space-y-2" data-testid={`new-order-item-${i}`}>
                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-12 sm:col-span-7">
                            <Label>{t("orders.selectProduct")}</Label>
                            <Combobox
                              items={products}
                              value={it.product_id}
                              onChange={(id, prod) => setItemProduct(i, id, prod)}
                              getKey={(p) => p.product_id}
                              getLabel={(p) => `${p.name} — ${formatVND(p.price)}`}
                              placeholder="Gõ tên hoặc SKU sản phẩm..."
                              searchKeys={["name", "sku", "category"]}
                              testId={`new-order-product-${i}`}
                              renderItem={(p) => (
                                <div className="flex w-full items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">{p.name}</div>
                                    <div className="text-xs text-ink-muted">
                                      {p.category} · Tồn: <span className={p.stock <= p.low_stock_threshold ? "text-red-600 font-medium" : ""}>{p.stock} {p.unit}</span>
                                    </div>
                                  </div>
                                  <div className="text-xs font-mono text-bamboo whitespace-nowrap">{formatVND(p.price)}</div>
                                </div>
                              )}
                            />
                          </div>
                          <div className="col-span-5 sm:col-span-2">
                            <Label>{t("common.quantity")}</Label>
                            <Input
                              type="number"
                              min={1}
                              value={it.quantity}
                              onChange={(e) => setItemQty(i, Number(e.target.value))}
                              data-testid={`new-order-qty-${i}`}
                            />
                          </div>
                          <div className="col-span-6 sm:col-span-2">
                            <Label>{t("orders.subtotal")}</Label>
                            <div className="h-9 flex items-center text-sm font-medium font-mono">{formatVND(it.subtotal)}</div>
                          </div>
                          <div className="col-span-1 pt-6">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} data-testid={`new-order-remove-item-${i}`}>
                              <Trash2 size={16} className="text-red-500" />
                            </Button>
                          </div>
                        </div>
                        {it.product_id && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-ink-muted">Tồn kho hiện tại:</span>
                            <Badge variant={lowOrOOS ? "cancelled" : "delivered"} data-testid={`new-order-stock-${i}`}>
                              {it.stock_left} {it.unit}
                            </Badge>
                            {it.stock_left < it.quantity && (
                              <span className="text-red-600 font-medium">⚠ Vượt tồn kho!</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("orders.payment")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t("orders.payment")}</Label>
                <Select value={payment} onChange={(e) => setPayment(e.target.value)} data-testid="new-order-payment">
                  <option value="cash">{t("payment.cash")}</option>
                  <option value="transfer">{t("payment.transfer")}</option>
                  <option value="debt">{t("payment.debt")}</option>
                  <option value="ewallet">{t("payment.ewallet")}</option>
                  <option value="card">{t("payment.card")}</option>
                </Select>
              </div>
              {payment === "debt" && (
                <div>
                  <Label>{t("orders.dueDate")}</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    data-testid="new-order-due-date"
                  />
                </div>
              )}
              <div>
                <Label>{t("orders.shipper")} (tùy chọn)</Label>
                <Select value={shipperId} onChange={(e) => setShipperId(e.target.value)} data-testid="new-order-shipper">
                  <option value="">— Không gán —</option>
                  {shippers.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Giảm % </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    data-testid="new-order-discount-percent"
                  />
                </div>
                <div>
                  <Label>Giảm VND</Label>
                  <Input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    data-testid="new-order-discount-fixed"
                  />
                </div>
              </div>
              <div>
                <Label>{t("orders.shipping")}</Label>
                <Input type="number" min={0} value={shipping} onChange={(e) => setShipping(e.target.value)} />
              </div>
              <div>
                <Label>{t("common.notes")}</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm"><span>{t("orders.subtotal")}</span><span className="font-mono">{formatVND(subtotal)}</span></div>
              {Number(discountPercent) > 0 && (
                <div className="flex justify-between text-sm text-ink-muted">
                  <span>Giảm {discountPercent}%</span>
                  <span className="font-mono">- {formatVND(percentDiscountAmount)}</span>
                </div>
              )}
              {Number(discount) > 0 && (
                <div className="flex justify-between text-sm text-ink-muted">
                  <span>{t("orders.discount")}</span>
                  <span className="font-mono">- {formatVND(Number(discount))}</span>
                </div>
              )}
              {Number(shipping) > 0 && (
                <div className="flex justify-between text-sm text-ink-muted">
                  <span>{t("orders.shipping")}</span>
                  <span className="font-mono">+ {formatVND(Number(shipping))}</span>
                </div>
              )}
              <div className="border-t border-border pt-3 mt-2 flex justify-between font-heading">
                <span className="font-semibold">{t("orders.total")}</span>
                <span className="font-bold text-bamboo text-lg" data-testid="new-order-total">{formatVND(total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
