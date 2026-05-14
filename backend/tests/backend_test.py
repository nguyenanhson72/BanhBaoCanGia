"""Backend tests for Banh Bao Admin API."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://bao-cms-admin.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@banhbao.vn"
ADMIN_PASSWORD = "admin123"
STAFF_EMAIL = "staff@banhbao.vn"
STAFF_PASSWORD = "staff123"


def _extract_cookie(resp, key):
    # requests stores cookies in resp.cookies; also check Set-Cookie header
    val = resp.cookies.get(key)
    if val:
        return val
    sc = resp.headers.get("Set-Cookie", "")
    for part in sc.split(","):
        if f"{key}=" in part:
            seg = part.strip().split(";")[0]
            return seg.split("=", 1)[1]
    return None


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    return r


def _no_objectid(obj):
    """Recursively check no '_id' key exists."""
    if isinstance(obj, dict):
        if "_id" in obj:
            return False
        return all(_no_objectid(v) for v in obj.values())
    if isinstance(obj, list):
        return all(_no_objectid(v) for v in obj)
    return True


@pytest.fixture(scope="session")
def admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = _extract_cookie(r, "access_token")
    assert tok, "no access_token cookie returned"
    return tok


@pytest.fixture(scope="session")
def admin_refresh():
    r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200
    return _extract_cookie(r, "refresh_token")


@pytest.fixture(scope="session")
def staff_token():
    r = _login(STAFF_EMAIL, STAFF_PASSWORD)
    assert r.status_code == 200, f"staff login failed: {r.status_code} {r.text}"
    return _extract_cookie(r, "access_token")


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def staff_headers(staff_token):
    return {"Authorization": f"Bearer {staff_token}"}


# ---------------- Auth ----------------
class TestAuth:
    def test_login_success(self):
        r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "password_hash" not in data
        assert _no_objectid(data)
        # cookies set
        assert _extract_cookie(r, "access_token")
        assert _extract_cookie(r, "refresh_token")

    def test_login_wrong_password(self):
        # use unique email to avoid lockout for valid admin
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongPass!" + uuid.uuid4().hex[:4]}, timeout=15)
        # Could be 401 or 429 (lockout). Accept either, but prefer 401
        assert r.status_code in (401, 429), r.text

    def test_me_with_bearer(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert "password_hash" not in data
        assert _no_objectid(data)

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_register_staff(self):
        email = f"test_{uuid.uuid4().hex[:8]}@banhbao.vn"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "pass1234", "name": "Test User", "role": "staff"
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email
        assert data["role"] == "staff"
        assert "password_hash" not in data
        assert _no_objectid(data)

    def test_refresh_token(self, admin_refresh):
        assert admin_refresh, "Need refresh_token"
        cookies = {"refresh_token": admin_refresh}
        r = requests.post(f"{API}/auth/refresh", cookies=cookies, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_logout(self, admin_token):
        cookies = {"access_token": admin_token}
        r = requests.post(f"{API}/auth/logout", cookies=cookies, timeout=15)
        assert r.status_code == 200
        # Set-Cookie should contain delete instructions
        sc = r.headers.get("Set-Cookie", "")
        assert "access_token" in sc


# ---------------- Dashboard ----------------
class TestDashboard:
    def test_dashboard_stats(self, admin_headers):
        r = requests.get(f"{API}/dashboard/stats", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("today_revenue", "today_orders", "total_debt", "total_products",
                    "chart_7days", "low_stock_products", "recent_orders", "top_products"):
            assert key in d, f"missing {key}"
        assert isinstance(d["chart_7days"], list) and len(d["chart_7days"]) == 7
        assert _no_objectid(d)


# ---------------- Products ----------------
class TestProducts:
    created_id = None

    def test_list_products_seed(self, admin_headers):
        r = requests.get(f"{API}/products", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 6
        assert _no_objectid(items)

    def test_create_product(self, admin_headers):
        payload = {
            "name": "TEST_Bao Pho Mai", "category": "Bánh bao mặn",
            "price": 25000, "cost": 12000, "stock": 50, "low_stock_threshold": 10,
            "unit": "cái", "description": "Test product"
        }
        r = requests.post(f"{API}/products", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == payload["name"]
        assert d["price"] == 25000
        assert d.get("product_id", "").startswith("prd_")
        assert _no_objectid(d)
        TestProducts.created_id = d["product_id"]

        # GET back via list
        r2 = requests.get(f"{API}/products", headers=admin_headers, timeout=15)
        names = [p["name"] for p in r2.json()]
        assert payload["name"] in names

    def test_update_product(self, admin_headers):
        pid = TestProducts.created_id
        assert pid
        upd = {
            "name": "TEST_Bao Pho Mai Updated", "category": "Bánh bao mặn",
            "price": 27000, "cost": 12500, "stock": 40, "low_stock_threshold": 10,
            "unit": "cái",
        }
        r = requests.put(f"{API}/products/{pid}", headers=admin_headers, json=upd, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == upd["name"]
        assert d["price"] == 27000

    def test_low_stock_filter(self, admin_headers):
        r = requests.get(f"{API}/products?low_stock=true", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        for p in items:
            assert p["stock"] <= p["low_stock_threshold"]

    def test_staff_cannot_delete(self, staff_headers):
        pid = TestProducts.created_id
        assert pid
        r = requests.delete(f"{API}/products/{pid}", headers=staff_headers, timeout=15)
        assert r.status_code == 403, r.text

    def test_admin_can_delete(self, admin_headers):
        pid = TestProducts.created_id
        r = requests.delete(f"{API}/products/{pid}", headers=admin_headers, timeout=15)
        assert r.status_code == 200


# ---------------- Customers ----------------
class TestCustomers:
    cid = None

    def test_list_customers(self, admin_headers):
        r = requests.get(f"{API}/customers", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 5
        assert _no_objectid(items)

    def test_crud_customer(self, admin_headers):
        # Create
        payload = {"name": "TEST_Cus", "phone": "0900000111", "email": "test_cus@x.vn", "address": "1 abc", "group": "new"}
        r = requests.post(f"{API}/customers", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Cus"
        assert d["customer_id"].startswith("cus_")
        TestCustomers.cid = d["customer_id"]

        # Update
        upd = {**payload, "name": "TEST_Cus Updated"}
        r2 = requests.put(f"{API}/customers/{TestCustomers.cid}", headers=admin_headers, json=upd, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST_Cus Updated"

        # Delete
        r3 = requests.delete(f"{API}/customers/{TestCustomers.cid}", headers=admin_headers, timeout=15)
        assert r3.status_code == 200


# ---------------- Suppliers ----------------
class TestSuppliers:
    def test_list_suppliers(self, admin_headers):
        r = requests.get(f"{API}/suppliers", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 3
        assert _no_objectid(items)

    def test_staff_cannot_create_supplier(self, staff_headers):
        r = requests.post(f"{API}/suppliers", headers=staff_headers,
                          json={"name": "TEST_NCC", "phone": "0900", "rating": 5}, timeout=15)
        assert r.status_code == 403

    def test_admin_can_create_supplier(self, admin_headers):
        r = requests.post(f"{API}/suppliers", headers=admin_headers,
                          json={"name": "TEST_NCC", "phone": "0900", "rating": 5}, timeout=15)
        assert r.status_code == 200
        sid = r.json()["supplier_id"]
        # Cleanup
        requests.delete(f"{API}/suppliers/{sid}", headers=admin_headers, timeout=15)


# ---------------- Orders ----------------
class TestOrders:
    order_id = None
    product_id = None
    original_stock = None

    def test_list_orders(self, admin_headers):
        r = requests.get(f"{API}/orders", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert _no_objectid(items)

    def test_create_order_decrements_stock(self, admin_headers):
        # Get a product
        r = requests.get(f"{API}/products", headers=admin_headers, timeout=15)
        p = r.json()[0]
        TestOrders.product_id = p["product_id"]
        TestOrders.original_stock = p["stock"]

        qty = 2
        payload = {
            "customer_name": "TEST_Customer",
            "customer_phone": "0900000000",
            "items": [{
                "product_id": p["product_id"], "name": p["name"], "price": p["price"],
                "quantity": qty, "subtotal": p["price"] * qty
            }],
            "payment_method": "cod",
            "discount": 0, "shipping_fee": 10000
        }
        r2 = requests.post(f"{API}/orders", headers=admin_headers, json=payload, timeout=15)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert d["total"] == p["price"] * qty + 10000
        assert d["status"] == "preparing"
        assert d["payment_method"] == "cod"
        assert d["is_paid"] is False
        assert len(d["timeline"]) >= 1
        assert _no_objectid(d)
        TestOrders.order_id = d["order_id"]

        # Verify stock decremented
        r3 = requests.get(f"{API}/products", headers=admin_headers, timeout=15)
        for pp in r3.json():
            if pp["product_id"] == p["product_id"]:
                assert pp["stock"] == TestOrders.original_stock - qty
                break

    def test_update_order_status_cancelled_restores_stock(self, admin_headers):
        oid = TestOrders.order_id
        assert oid
        r = requests.put(f"{API}/orders/{oid}/status", headers=admin_headers,
                         json={"status": "cancelled", "note": "test cancel"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "cancelled"
        assert len(d["timeline"]) >= 2
        # Stock should be restored
        r2 = requests.get(f"{API}/products", headers=admin_headers, timeout=15)
        for pp in r2.json():
            if pp["product_id"] == TestOrders.product_id:
                assert pp["stock"] == TestOrders.original_stock
                break


# ---------------- Reports ----------------
class TestReports:
    @pytest.mark.parametrize("period,expected", [("daily", 30), ("weekly", 12), ("monthly", 12)])
    def test_revenue_report(self, admin_headers, period, expected):
        r = requests.get(f"{API}/reports/revenue?period={period}", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["period"] == period
        assert isinstance(d["data"], list)
        assert len(d["data"]) == expected

    def test_debt_report(self, admin_headers):
        r = requests.get(f"{API}/reports/debt", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "total" in d
        assert isinstance(d["items"], list)
        assert _no_objectid(d)

    def test_inventory_report(self, admin_headers):
        r = requests.get(f"{API}/reports/inventory", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_stock_value", "low_stock_count", "products", "total_products"):
            assert k in d
        assert _no_objectid(d)


# ---------------- Users ----------------
class TestUsers:
    def test_list_users_admin(self, admin_headers):
        r = requests.get(f"{API}/users", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 2
        for u in items:
            assert "password_hash" not in u
        assert _no_objectid(items)

    def test_list_users_staff_forbidden(self, staff_headers):
        r = requests.get(f"{API}/users", headers=staff_headers, timeout=15)
        assert r.status_code == 403


# ---------------- Chat ----------------
class TestChat:
    def test_chat_calls_claude(self, admin_headers):
        session_id = f"test_session_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/chat", headers=admin_headers,
                          json={"session_id": session_id, "message": "Tổng doanh thu hôm nay là bao nhiêu?"},
                          timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "reply" in d
        assert isinstance(d["reply"], str)
        assert len(d["reply"]) > 0
        assert d["session_id"] == session_id

        # Check history
        time.sleep(1)
        r2 = requests.get(f"{API}/chat/history?session_id={session_id}", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        msgs = r2.json()
        assert len(msgs) >= 2
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles
        assert _no_objectid(msgs)
