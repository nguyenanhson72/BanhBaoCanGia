"""Tests for the 13 new improvements added in iteration 2."""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://bao-cms-admin.preview.emergentagent.com"
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@banhbao.vn"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.cookies.get("access_token")
    assert tok
    return {"Authorization": f"Bearer {tok}"}


# 1) Orders sorted by created_at desc by default
class TestOrdersDefaultSort:
    def test_orders_sorted_desc(self, admin_headers):
        r = requests.get(f"{API}/orders", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 2, "need at least 2 orders to verify sort"
        ts = [it["created_at"] for it in items]
        # Should be non-increasing (descending)
        for i in range(len(ts) - 1):
            assert ts[i] >= ts[i + 1], f"orders not sorted desc: {ts[i]} < {ts[i+1]}"


# 2) Date range filter on Orders
class TestOrdersDateRange:
    def test_date_range_filter(self, admin_headers):
        # broad range first
        r = requests.get(f"{API}/orders", headers=admin_headers, params={"date_from": "2026-05-10", "date_to": "2026-05-13"}, timeout=15)
        assert r.status_code == 200, r.text
        items = r.json()
        # validate each within range
        from_dt = datetime.fromisoformat("2026-05-10").replace(tzinfo=timezone.utc)
        to_dt = datetime.fromisoformat("2026-05-13").replace(tzinfo=timezone.utc)
        # backend adds +1 day on date_to, so cutoff is 2026-05-14
        for it in items:
            raw = it["created_at"].replace("Z", "+00:00")
            t = datetime.fromisoformat(raw)
            if t.tzinfo is None:
                t = t.replace(tzinfo=timezone.utc)
            assert t >= from_dt, f"{t} before {from_dt}"
            assert t < to_dt.replace(day=14), f"{t} after cutoff"

    def test_narrow_range(self, admin_headers):
        # Past-only range, should return list (possibly empty)
        r = requests.get(f"{API}/orders", headers=admin_headers, params={"date_from": "2020-01-01", "date_to": "2020-01-02"}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# 3) discount_percent on POST /api/orders
class TestOrderDiscountPercent:
    def test_create_order_with_discount_percent(self, admin_headers):
        # Get a product
        p = requests.get(f"{API}/products", headers=admin_headers, timeout=15).json()[0]
        qty = 5
        subtotal = p["price"] * qty
        payload = {
            "customer_name": "TEST_PercentCust",
            "customer_phone": "0900000777",
            "customer_address": "123 Test St",
            "items": [{
                "product_id": p["product_id"], "name": p["name"], "price": p["price"],
                "quantity": qty, "subtotal": subtotal,
            }],
            "payment_method": "cash",
            "discount": 5000,
            "discount_percent": 10,
            "shipping_fee": 0,
        }
        r = requests.post(f"{API}/orders", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        expected_percent = round(subtotal * 10 / 100, 2)
        expected_total = subtotal - 5000 - expected_percent + 0
        assert d["subtotal"] == subtotal
        assert d["discount"] == 5000
        assert d["discount_percent"] == 10
        # discount_amount field added per server.py
        assert d.get("discount_amount") == 5000 + expected_percent
        assert d["total"] == expected_total, f"expected {expected_total}, got {d['total']}"
        assert d["customer_address"] == "123 Test St"


# 4) customer_address present in response (also tested above)
class TestCustomerAddressInOrder:
    def test_customer_address_persisted(self, admin_headers):
        p = requests.get(f"{API}/products", headers=admin_headers, timeout=15).json()[0]
        payload = {
            "customer_name": "TEST_AddrCust",
            "customer_phone": "0900000888",
            "customer_address": "456 Le Loi, Q1",
            "items": [{
                "product_id": p["product_id"], "name": p["name"], "price": p["price"],
                "quantity": 1, "subtotal": p["price"],
            }],
            "payment_method": "cash",
        }
        r = requests.post(f"{API}/orders", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        oid = d["order_id"]
        assert d["customer_address"] == "456 Le Loi, Q1"
        # GET to verify persistence
        r2 = requests.get(f"{API}/orders/{oid}", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["customer_address"] == "456 Le Loi, Q1"


# 5) Inventory report negative stock fields
class TestInventoryNegativeStock:
    def test_inventory_returns_negative_fields(self, admin_headers):
        r = requests.get(f"{API}/reports/inventory", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "negative_stock_count" in d, "missing negative_stock_count"
        assert "negative_stock_products" in d, "missing negative_stock_products"
        assert isinstance(d["negative_stock_count"], int)
        assert isinstance(d["negative_stock_products"], list)
        # all listed must have stock < 0
        for p in d["negative_stock_products"]:
            assert p.get("stock", 0) < 0


# 6) Revenue report date range support (date_from / date_to)
class TestRevenueDateRange:
    def test_revenue_with_date_range(self, admin_headers):
        # Try with date_from/date_to query params (review requirement)
        r = requests.get(
            f"{API}/reports/revenue",
            headers=admin_headers,
            params={"date_from": "2026-05-01", "date_to": "2026-05-14"},
            timeout=20,
        )
        # Endpoint must accept these params and return daily buckets for that range (14 days)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "data" in d
        # Expect ~14 daily buckets when date range provided
        assert len(d["data"]) == 14, f"expected 14 daily buckets, got {len(d['data'])}"

    def test_revenue_default_period_still_works(self, admin_headers):
        r = requests.get(f"{API}/reports/revenue?period=daily", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert len(r.json()["data"]) == 30


# 7) Product CRUD with base64 image_url
class TestProductBase64Image:
    def test_product_with_base64_image(self, admin_headers):
        # ~50KB base64 string (smaller for test speed, but well over typical inline)
        b64 = "data:image/png;base64," + ("A" * 50_000)
        payload = {
            "name": f"TEST_Base64_{uuid.uuid4().hex[:6]}",
            "category": "Bánh bao mặn",
            "price": 10000, "cost": 5000, "stock": 10,
            "low_stock_threshold": 5, "unit": "cái",
            "image_url": b64,
        }
        r = requests.post(f"{API}/products", headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        pid = d["product_id"]
        assert d["image_url"] == b64

        # GET via list and confirm persisted
        r2 = requests.get(f"{API}/products", headers=admin_headers, timeout=20)
        found = next((p for p in r2.json() if p["product_id"] == pid), None)
        assert found is not None
        assert found["image_url"] == b64

        # Update with new base64
        b64_new = "data:image/png;base64," + ("B" * 30_000)
        upd = {**payload, "image_url": b64_new}
        r3 = requests.put(f"{API}/products/{pid}", headers=admin_headers, json=upd, timeout=20)
        assert r3.status_code == 200
        assert r3.json()["image_url"] == b64_new

        # Cleanup
        requests.delete(f"{API}/products/{pid}", headers=admin_headers, timeout=15)
