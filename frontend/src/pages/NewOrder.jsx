import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import api from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Label, Textarea } from "../components/ui/Input";
import { toast } from "../components/ui/Toast";
import { useI18n } from "../contexts/I18nContext";
import { formatVND } from "../lib/utils";

export default function NewOrder() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [items, setItems] = useState([]);
  const [payment, setPayment] = useState("cash");
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, p] = await Promise.all([api.get("/customers"), api.get("/products")]);
      setCustomers(c.data);
      setProducts(p.data);
    })();
  }, []);

  const selectCustomer = (id) => {
    setCustomerId(id);
    const c = customers.find((x) => x.customer_id === id);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone || "");
    }
  };

  const addItem = () => {
    if (products.length === 0) return;
    const p = products[0];
    setItems((prev) => [
      ...prev,
      { product_id: p.product_id, name: p.name, price: p.price, quantity: 1, subtotal: p.price },
    ]);
  };

  const updateItem = (idx, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "product_id") {
        const p = products.find((x) => x.product_id === value);
        if (p) {
          next[idx].name = p.name;
          next[idx].price = p.price;
        }
      }
      next[idx].subtotal = (Number(next[idx].price) || 0) * (Number(next[idx].quantity) || 0);
      return next;
    });
  };

  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, it) => s + (it.subtotal || 0), 0);
  const total = subtotal - Number(discount || 0) + Number(shipping || 0);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || items.length === 0) {
      toast({ title: "Vui lòng nhập khách hàng và ít nhất 1 sản phẩm", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/orders", {
        customer_id: customerId || null,
        customer_name: customerName,
        customer_phone: customerPhone,
        items,
        payment_method: payment,
        discount: Number(discount) || 0,
        shipping_fee: Number(shipping) || 0,
        note,
      });
      toast({ title: t("common.saved"), variant: "success" });
      navigate(`/orders/${data.order_id}`);
    } catch (e) {
      toast({ title: e?.response?.data?.detail || t("common.error"), variant: "error" });
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
                <Select value={customerId} onChange={(e) => selectCustomer(e.target.value)} data-testid="new-order-customer-select">
                  <option value="">— {t("common.add")} —</option>
                  {customers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </Select>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("orders.items")}</CardTitle>
                <Button type="button" variant="secondary" size="sm" onClick={addItem} data-testid="new-order-add-item">
                  <Plus size={14} /> {t("orders.addItem")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center text-sm text-ink-muted py-6">{t("common.empty")}</div>
              ) : (
                <div className="space-y-3">
                  {items.map((it, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end" data-testid={`new-order-item-${i}`}>
                      <div className="col-span-12 sm:col-span-6">
                        <Label>{t("orders.selectProduct")}</Label>
                        <Select value={it.product_id} onChange={(e) => updateItem(i, "product_id", e.target.value)}>
                          {products.map((p) => (
                            <option key={p.product_id} value={p.product_id}>{p.name} ({formatVND(p.price)})</option>
                          ))}
                        </Select>
                      </div>
                      <div className="col-span-5 sm:col-span-2">
                        <Label>{t("common.quantity")}</Label>
                        <Input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Label>{t("orders.subtotal")}</Label>
                        <div className="h-9 flex items-center text-sm font-medium">{formatVND(it.subtotal)}</div>
                      </div>
                      <div className="col-span-1">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} data-testid={`new-order-remove-item-${i}`}>
                          <Trash2 size={16} className="text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
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
                  <option value="cod">{t("payment.cod")}</option>
                  <option value="card">{t("payment.card")}</option>
                </Select>
              </div>
              <div>
                <Label>{t("orders.discount")}</Label>
                <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
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
              <div className="flex justify-between text-sm text-ink-muted"><span>{t("orders.discount")}</span><span className="font-mono">- {formatVND(Number(discount) || 0)}</span></div>
              <div className="flex justify-between text-sm text-ink-muted"><span>{t("orders.shipping")}</span><span className="font-mono">+ {formatVND(Number(shipping) || 0)}</span></div>
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
