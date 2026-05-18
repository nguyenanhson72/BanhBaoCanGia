"""Backend tests for Bánh Bao Admin API v2 (Phase 0+1+2+3+4+6+7 rewrite).

Covers: system, settings, materials/stock, customers (CRUD + care + export +
template + import), suppliers, orders (new statuses + duplicate + assign shipper),
debts (customer + supplier + payments), users/shippers, RBAC, AI chat, no _id leaks.
"""
import io
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://bao-cms-admin.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@banhbao.vn"
ADMIN_PASSWORD = "admin123"


# ---------- helpers ----------
def _no_id(obj):
    if isinstance(obj, dict):
        if "_id" in obj:
            return False
        return all(_no_id(v) for v in obj.values())
    if isinstance(obj, list):
        return all(_no_id(v) for v in obj)
    return True


def _extract_cookie(resp, key):
    val = resp.cookies.get(key)
    if val:
        return val
    sc = resp.headers.get("Set-Cookie", "")
    for part in sc.split(","):
        if f"{key}=" in part:
            return part.strip().split(";")[0].split("=", 1)[1]
    return None


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = _extract_cookie(r, "access_token")
    assert tok
    return tok


@pytest.fixture
def H(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def shipper_user_and_token():
    """Create a fresh shipper user and login to get token."""
    # login as admin first
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    admin_tok = _extract_cookie(r, "access_token")
    h = {"Authorization": f"Bearer {admin_tok}"}
    email = f"test_shipper_{uuid.uuid4().hex[:8]}@banhbao.vn"
    pwd = "ship1234"
    reg = requests.post(f"{API}/auth/register", headers=h, json={
        "email": email, "password": pwd, "name": "TEST Shipper", "role": "shipper",
    }, timeout=15)
    assert reg.status_code == 200, reg.text
    user_id = reg.json().get("user_id")
    login = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert login.status_code == 200, login.text
    tok = _extract_cookie(login, "access_token")
    yield {"user_id": user_id, "token": tok, "email": email}
    # cleanup
    try:
        requests.delete(f"{API}/users/{user_id}", headers=h, timeout=10)
    except Exception:
        pass


# ===========================================================================
# System
# ===========================================================================
class TestSystem:
    def test_auth_login_admin(self, admin_token):
        # Just ensures fixture worked + cookie set
        assert admin_token

    def test_system_time(self):
        r = requests.get(f"{API}/system/time", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("utc", "vn", "timestamp_ms"):
            assert k in d, f"missing {k}"
        assert isinstance(d["timestamp_ms"], int)

    def test_system_permissions(self, H):
        r = requests.get(f"{API}/system/permissions", headers=H, timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("roles", "keys", "defaults", "mine"):
            assert k in d
        assert "admin" in d["roles"]
        assert "shipper" in d["roles"]
        assert "customers.view" in d["keys"]
        assert "delivery.view" in d["keys"]
        # admin should have full permissions
        assert "customers.view" in d["mine"]
        # default shipper has delivery.view but not customers.view in its default list
        assert "delivery.view" in d["defaults"]["shipper"]
        assert "customers.view" not in d["defaults"]["shipper"]

    def test_reset_demo_without_confirm(self, H):
        # confirm is a required Query param -> FastAPI returns 422 when missing,
        # 400 when present but != "YES_DELETE" (per endpoint logic).
        r = requests.post(f"{API}/system/reset-demo", headers=H, timeout=10)
        assert r.status_code in (400, 422), r.text
        r2 = requests.post(f"{API}/system/reset-demo?confirm=NO", headers=H, timeout=10)
        assert r2.status_code == 400, r2.text


# ===========================================================================
# Settings
# ===========================================================================
class TestSettings:
    def test_get_settings_defaults(self, H):
        r = requests.get(f"{API}/settings", headers=H, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "shop_name" in d
        assert "bill_show_logo" in d
        assert _no_id(d)

    def test_put_settings_persists(self, H):
        payload = {
            "shop_name": "TEST Tiệm Bánh Bao",
            "address": "1 Lê Lợi",
            "phone": "0900000111",
            "email": "shop@test.vn",
            "tax_id": "",
            "bank_name": "Vietcombank",
            "bank_account": "1234567890",
            "bank_account_holder": "Test",
            "bill_show_logo": True,
            "bill_show_address": True,
            "bill_show_phone": True,
            "bill_show_email": False,
            "bill_show_website": False,
            "bill_show_tax_id": False,
            "bill_show_bank_qr": False,
            "bill_footer_text": "Test footer",
            "default_language": "vi",
        }
        r = requests.put(f"{API}/settings", headers=H, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["shop_name"] == "TEST Tiệm Bánh Bao"
        assert d["bank_name"] == "Vietcombank"
        assert d["bill_show_bank_qr"] is False
        # verify persistence
        g = requests.get(f"{API}/settings", headers=H, timeout=10).json()
        assert g["shop_name"] == "TEST Tiệm Bánh Bao"
        assert g["bill_footer_text"] == "Test footer"
        assert _no_id(g)


# ===========================================================================
# Customers - basic + new fields
# ===========================================================================
class TestCustomers:
    created = {}

    def test_create_customer_with_new_fields(self, H):
        payload = {
            "name": "TEST KH Sỉ",
            "nickname": "Anh A",
            "phone": "0900111222",
            "address": "1 Lê Duẩn",
            "district": "Quận 1",
            "city": "TP.HCM",
            "tax_id": "MST123",
            "group": "vip",
            "type": "wholesale",
            "classification": "VIP-A",
            "max_debt_days": 14,
            "max_debt_amount": 5000000,
        }
        r = requests.post(f"{API}/customers", headers=H, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST KH Sỉ"
        assert d["customer_id"].startswith("cus_")
        assert d.get("code"), "code must be auto-generated"
        assert d.get("code", "").startswith("KH")
        assert d["type"] == "wholesale"
        assert d["max_debt_days"] == 14
        assert d["classification"] == "VIP-A"
        assert _no_id(d)
        TestCustomers.created["id"] = d["customer_id"]

        # verify GET back via list
        lst = requests.get(f"{API}/customers", headers=H, timeout=10).json()
        assert any(c["customer_id"] == d["customer_id"] for c in lst)

    def test_customers_care(self, H):
        r = requests.get(f"{API}/customers/care?days=14", headers=H, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("items", "total", "needs_care_count", "cutoff_days"):
            assert k in d
        # new customer (no orders) should have needs_care=True
        if d["items"]:
            ours = [x for x in d["items"] if x.get("customer_id") == TestCustomers.created.get("id")]
            if ours:
                assert ours[0]["needs_care"] is True
                assert ours[0]["order_count"] == 0

    def test_export_excel(self, H):
        r = requests.get(f"{API}/customers/export", headers=H, timeout=20)
        assert r.status_code == 200
        ct = r.headers.get("Content-Type", "")
        assert "spreadsheetml" in ct or "officedocument" in ct, ct
        assert len(r.content) > 100

    def test_import_template_returns_xlsx(self, H):
        r = requests.get(f"{API}/customers/import-template", headers=H, timeout=15)
        assert r.status_code == 200
        ct = r.headers.get("Content-Type", "")
        assert "spreadsheetml" in ct or "officedocument" in ct, ct
        TestCustomers.created["template_bytes"] = r.content

    def test_import_xlsx(self, H):
        raw = TestCustomers.created.get("template_bytes")
        assert raw, "Need template bytes from previous test"
        # Build a fresh xlsx with unique name to ensure insert
        import pandas as pd
        df = pd.DataFrame([{
            "code": "",
            "name": f"TEST_Import_{uuid.uuid4().hex[:6]}",
            "nickname": "Imp",
            "phone": f"099{uuid.uuid4().hex[:7]}",
            "email": "imp@test.vn",
            "address": "X",
            "district": "Quận 3",
            "city": "TP.HCM",
            "tax_id": "",
            "group": "new",
            "type": "retail",
            "classification": "",
            "max_debt_days": 0,
            "max_debt_amount": 0,
            "notes": "",
        }])
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as w:
            df.to_excel(w, index=False, sheet_name="customers")
        buf.seek(0)
        files = {"file": ("c.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = requests.post(f"{API}/customers/import", headers=H, files=files, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["inserted"] == 1, d

    def test_cleanup_customer(self, H):
        cid = TestCustomers.created.get("id")
        if cid:
            requests.delete(f"{API}/customers/{cid}", headers=H, timeout=10)


# ===========================================================================
# Materials & Stock
# ===========================================================================
class TestMaterialsStock:
    state = {}

    def test_create_material(self, H):
        payload = {
            "name": "TEST_Bột mì",
            "code": f"MAT{uuid.uuid4().hex[:5].upper()}",
            "unit": "kg",
            "stock": 0,
            "cost": 20000,
            "low_stock_threshold": 5,
            "expiration_days": 90,
        }
        r = requests.post(f"{API}/materials", headers=H, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == payload["name"]
        assert d.get("material_id", "").startswith("mat_")
        assert _no_id(d)
        TestMaterialsStock.state["mat_id"] = d["material_id"]

    def test_list_materials(self, H):
        r = requests.get(f"{API}/materials", headers=H, timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(m["material_id"] == TestMaterialsStock.state["mat_id"] for m in items)
        assert _no_id(items)

    def test_stock_in_updates_material_and_creates_movement(self, H):
        mat_id = TestMaterialsStock.state["mat_id"]
        r = requests.post(f"{API}/stock/in", headers=H, json={
            "kind": "material", "target_id": mat_id, "quantity": 10.5, "unit_price": 20000,
            "supplier_name": "TEST NCC",
            "production_date": "2026-01-01",
        }, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kind"] == "material" and d["target_id"] == mat_id
        assert d["quantity"] == 10.5
        # GET material -> stock should be 10.5
        lst = requests.get(f"{API}/materials", headers=H, timeout=10).json()
        mat = next(m for m in lst if m["material_id"] == mat_id)
        assert mat["stock"] == 10.5, mat
        # movement listed
        mv = requests.get(f"{API}/stock/movements?kind=material&target_id={mat_id}", headers=H, timeout=10)
        assert mv.status_code == 200
        movements = mv.json()
        assert len(movements) >= 1
        assert movements[0]["type"] == "in"
        assert _no_id(movements)

    def test_update_and_delete_material(self, H):
        mat_id = TestMaterialsStock.state["mat_id"]
        upd = requests.put(f"{API}/materials/{mat_id}", headers=H, json={
            "name": "TEST_Bột mì U", "unit": "kg", "stock": 10.5, "cost": 22000,
            "low_stock_threshold": 5, "expiration_days": 60,
        }, timeout=10)
        assert upd.status_code == 200, upd.text
        assert upd.json()["name"] == "TEST_Bột mì U"
        d = requests.delete(f"{API}/materials/{mat_id}", headers=H, timeout=10)
        assert d.status_code == 200


# ===========================================================================
# Suppliers
# ===========================================================================
class TestSuppliers:
    sid = None

    def test_create_supplier_new_fields(self, H):
        r = requests.post(f"{API}/suppliers", headers=H, json={
            "name": "TEST_NCC v2",
            "code": "NCC001",
            "phone": "0901112223",
            "district": "Quận 2",
            "city": "TP.HCM",
            "tax_id": "MST-NCC",
            "group": "bột",
            "rating": 4,
        }, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_NCC v2"
        assert d.get("district") == "Quận 2"
        assert d.get("tax_id") == "MST-NCC"
        TestSuppliers.sid = d["supplier_id"]

    def test_cleanup_supplier(self, H):
        if TestSuppliers.sid:
            requests.delete(f"{API}/suppliers/{TestSuppliers.sid}", headers=H, timeout=10)


# ===========================================================================
# Orders - new fields, statuses, duplicate, assign-shipper
# ===========================================================================
class TestOrders:
    state = {}

    def test_seed_product(self, H):
        r = requests.post(f"{API}/products", headers=H, json={
            "name": f"TEST_Prod_{uuid.uuid4().hex[:5]}",
            "price": 25000, "cost": 12000, "stock": 50,
            "low_stock_threshold": 5, "unit": "cái",
        }, timeout=10)
        assert r.status_code == 200, r.text
        TestOrders.state["prod_id"] = r.json()["product_id"]
        TestOrders.state["prod_price"] = 25000

    def test_seed_customer_with_max_debt_days(self, H):
        r = requests.post(f"{API}/customers", headers=H, json={
            "name": "TEST_OrdCus",
            "phone": "0900000333",
            "type": "wholesale",
            "max_debt_days": 7,
        }, timeout=10)
        assert r.status_code == 200, r.text
        TestOrders.state["cid"] = r.json()["customer_id"]

    def test_create_order_with_debt(self, H):
        pid = TestOrders.state["prod_id"]
        cid = TestOrders.state["cid"]
        payload = {
            "customer_id": cid,
            "customer_name": "TEST_OrdCus",
            "customer_phone": "0900000333",
            "customer_district": "Quận 4",
            "type": "wholesale",
            "items": [{"product_id": pid, "name": "TEST_Prod", "price": 25000, "quantity": 4, "subtotal": 100000}],
            "payment_method": "debt",
            "discount_percent": 10,
            "shipping_fee": 20000,
        }
        r = requests.post(f"{API}/orders", headers=H, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        # subtotal 100000, 10% discount = 10000, +ship 20000 = 110000
        assert d["subtotal"] == 100000
        assert d["total"] == 110000, d
        assert d["payment_method"] == "debt"
        assert d["is_paid"] is False
        assert d["remaining_amount"] == 110000
        assert d["status"] == "new"
        assert d["type"] == "wholesale"
        assert d["customer_district"] == "Quận 4"
        # due_date should be auto-set to ~7 days out
        assert d.get("due_date"), "due_date should be auto-computed from customer.max_debt_days"
        assert _no_id(d)
        TestOrders.state["order_id"] = d["order_id"]
        TestOrders.state["order_code"] = d["order_code"]

    def test_status_transitions_new_to_processing_to_delivering(self, H):
        oid = TestOrders.state["order_id"]
        for new_status in ["processing", "delivering"]:
            r = requests.put(f"{API}/orders/{oid}/status", headers=H,
                             json={"status": new_status, "note": f"to {new_status}"}, timeout=10)
            assert r.status_code == 200, r.text
            assert r.json()["status"] == new_status

    def test_debt_pending_status(self, H):
        oid = TestOrders.state["order_id"]
        r = requests.put(f"{API}/orders/{oid}/status", headers=H,
                         json={"status": "debt_pending"}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "debt_pending"

    def test_assign_shipper(self, H, shipper_user_and_token):
        oid = TestOrders.state["order_id"]
        sid = shipper_user_and_token["user_id"]
        r = requests.put(f"{API}/orders/{oid}/assign-shipper?shipper_id={sid}", headers=H, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["assigned_shipper_id"] == sid
        assert d.get("assigned_shipper_name") == "TEST Shipper"

    def test_duplicate_order(self, H):
        oid = TestOrders.state["order_id"]
        r = requests.post(f"{API}/orders/{oid}/duplicate", headers=H, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["order_id"] != oid
        assert d["order_code"] != TestOrders.state["order_code"]
        assert d["status"] == "new"
        TestOrders.state["dup_id"] = d["order_id"]

    def test_users_shippers_endpoint(self, H, shipper_user_and_token):
        r = requests.get(f"{API}/users/shippers", headers=H, timeout=10)
        assert r.status_code == 200
        items = r.json()
        ids = [u["user_id"] for u in items]
        assert shipper_user_and_token["user_id"] in ids


# ===========================================================================
# Debts
# ===========================================================================
class TestDebts:
    def test_debts_customers_list(self, H):
        r = requests.get(f"{API}/debts/customers", headers=H, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("items", "total", "overdue_total", "due_soon_total"):
            assert k in d, f"missing {k} -- got {list(d.keys())}"
        assert isinstance(d["items"], list)
        assert _no_id(d)

    def test_debts_customer_orders(self, H):
        cid = TestOrders.state.get("cid")
        assert cid
        r = requests.get(f"{API}/debts/customers/{cid}/orders", headers=H, timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # our debt order should be included (debt_pending isn't cancelled and payment_method=debt)
        # The duplicated order may also count
        if items:
            it = items[0]
            assert "overdue" in it or "days_to_due" in it
        assert _no_id(items)

    def test_collect_partial_payment(self, H):
        oid = TestOrders.state["order_id"]
        r = requests.post(f"{API}/debts/collect", headers=H, json={
            "order_id": oid, "amount": 30000, "method": "cash", "notes": "partial"
        }, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["order"]["remaining_amount"] == 80000
        assert d["order"]["paid_amount"] == 30000
        assert d["order"]["is_paid"] is False
        assert d["payment"]["direction"] == "in"
        assert d["payment"]["amount"] == 30000
        assert _no_id(d)

    def test_pay_supplier(self, H):
        # need a supplier
        r = requests.post(f"{API}/suppliers", headers=H, json={"name": "TEST_NCC_pay", "phone": "0"}, timeout=10)
        sid = r.json()["supplier_id"]
        try:
            p = requests.post(f"{API}/debts/pay-supplier", headers=H, json={
                "supplier_id": sid, "amount": 500000, "method": "transfer", "notes": "pay batch 1"
            }, timeout=10)
            assert p.status_code == 200, p.text
            d = p.json()
            assert d["direction"] == "out"
            assert d["amount"] == 500000
            assert d["supplier_id"] == sid
            assert _no_id(d)
        finally:
            requests.delete(f"{API}/suppliers/{sid}", headers=H, timeout=10)

    def test_debts_payments_history(self, H):
        r = requests.get(f"{API}/debts/payments", headers=H, timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 2
        dirs = {it["direction"] for it in items}
        assert "in" in dirs and "out" in dirs
        assert _no_id(items)

    def test_cleanup_orders_and_customer(self, H):
        # remove orders + customer + product
        for oid_key in ("order_id", "dup_id"):
            oid = TestOrders.state.get(oid_key)
            if oid:
                requests.delete(f"{API}/orders/{oid}", headers=H, timeout=10)
        cid = TestOrders.state.get("cid")
        if cid:
            requests.delete(f"{API}/customers/{cid}", headers=H, timeout=10)
        pid = TestOrders.state.get("prod_id")
        if pid:
            requests.delete(f"{API}/products/{pid}", headers=H, timeout=10)


# ===========================================================================
# RBAC: shipper user
# ===========================================================================
class TestRBAC:
    def test_shipper_cannot_view_customers(self, shipper_user_and_token):
        h = {"Authorization": f"Bearer {shipper_user_and_token['token']}"}
        r = requests.get(f"{API}/customers", headers=h, timeout=10)
        assert r.status_code == 403, f"expected 403 for shipper on /customers, got {r.status_code}"

    def test_shipper_can_view_orders(self, shipper_user_and_token):
        h = {"Authorization": f"Bearer {shipper_user_and_token['token']}"}
        r = requests.get(f"{API}/orders", headers=h, timeout=10)
        assert r.status_code == 200, r.text

    def test_shipper_permissions_self(self, shipper_user_and_token):
        h = {"Authorization": f"Bearer {shipper_user_and_token['token']}"}
        r = requests.get(f"{API}/system/permissions", headers=h, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "delivery.view" in d["mine"]
        assert "orders.view" in d["mine"]
        assert "customers.view" not in d["mine"]


# ===========================================================================
# Chat
# ===========================================================================
class TestChat:
    def test_chat_claude(self, H):
        sid = f"test_v2_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/chat", headers=H, json={
            "session_id": sid, "message": "Hi", "model": "claude",
        }, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["reply"] and isinstance(d["reply"], str)
        assert "claude" in d.get("model", "").lower()

    def test_chat_gpt_52(self, H):
        sid = f"test_v2_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/chat", headers=H, json={
            "session_id": sid, "message": "Hi", "model": "gpt-5.2",
        }, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["reply"] and isinstance(d["reply"], str)
        m = d.get("model", "").lower()
        assert "openai" in m and "5.2" in m


# ===========================================================================
# Misc: no _id leaks + backwards compat
# ===========================================================================
class TestMisc:
    def test_orders_list_no_legacy_status_or_cod(self, H):
        r = requests.get(f"{API}/orders?limit=200", headers=H, timeout=15)
        assert r.status_code == 200
        items = r.json()
        for o in items:
            assert o.get("status") != "preparing", "legacy status not migrated"
            assert o.get("payment_method") != "cod", "legacy cod not migrated to debt"
        assert _no_id(items)
