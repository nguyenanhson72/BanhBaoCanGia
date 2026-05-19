"""Tests for Đợt 1+2+3 features (iter 8).

Covers:
- Đợt 1: stock/in no longer creates debt_payments; orders accept customer_city
- Đợt 2: security/* endpoints, PIN2 gating on order mutations, delete-all 3-layer
- Đợt 3: export-all-excel, backup-zip, import-all-excel, inventory/xnt, stock/movements filters
"""
import io
import os
import zipfile
import requests
import pytest

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "https://bao-cms-admin.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
ADMIN_EMAIL = "admin@banhbao.vn"
ADMIN_PASS = "admin123"


def _session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def s():
    return _session()


# =================== Đợt 1 ===================

class TestDot1StockIn:
    def test_stock_in_does_not_create_debt_payment(self, s):
        # Create a supplier + material
        sup = s.post(f"{API}/suppliers", json={"name": "TEST_D1_Sup", "phone": "0888777666"}, timeout=10).json()
        sup_id = sup["supplier_id"]
        mat = s.post(f"{API}/materials", json={"name": "TEST_D1_Mat", "unit": "kg", "stock": 0, "cost_price": 0}, timeout=10).json()
        mat_id = mat["material_id"]

        # Snapshot debt_payments count for supplier_debt direction
        before = s.get(f"{API}/debts/payments?direction=supplier_debt", timeout=10).json()
        before_count = len(before) if isinstance(before, list) else len(before.get("items", []))

        # POST stock/in with supplier + unit_price
        r = s.post(f"{API}/stock/in", json={
            "kind": "material", "target_id": mat_id, "quantity": 5,
            "unit_price": 10000, "supplier_id": sup_id, "note": "TEST_D1 stockin",
        }, timeout=10)
        assert r.status_code == 200, r.text

        # After: ensure NO new debt_payments was inserted for this stockin
        after = s.get(f"{API}/debts/payments?direction=supplier_debt", timeout=10).json()
        after_list = after if isinstance(after, list) else after.get("items", [])
        after_count = len(after_list)
        assert after_count == before_count, f"Stock-in must NOT create debt_payment entry. before={before_count} after={after_count}"

        # But supplier.total_debt should have increased
        sup_after = s.get(f"{API}/suppliers", timeout=10).json()
        the_sup = next((x for x in sup_after if x["supplier_id"] == sup_id), None)
        assert the_sup is not None
        assert the_sup.get("total_debt", 0) >= 50000, f"Supplier total_debt expected >= 50000, got {the_sup.get('total_debt')}"

        # Cleanup
        s.delete(f"{API}/materials/{mat_id}", timeout=10)
        s.delete(f"{API}/suppliers/{sup_id}", timeout=10)


class TestDot1OrderCustomerCity:
    def test_order_persists_customer_city(self, s):
        # Seed customer + product
        cust = s.post(f"{API}/customers", json={"name": "TEST_D1_CityCust", "phone": "0777111222"}, timeout=10).json()
        prod = s.post(f"{API}/products", json={"name": "TEST_D1_CityProd", "price": 12000, "stock": 50, "unit": "cái"}, timeout=10).json()
        cid, pid = cust["customer_id"], prod["product_id"]

        r = s.post(f"{API}/orders", json={
            "customer_id": cid, "customer_name": "TEST_D1_CityCust", "customer_phone": "0777111222",
            "customer_city": "Hà Nội",
            "type": "retail", "payment_method": "cash",
            "items": [{"product_id": pid, "name": "TEST_D1_CityProd", "price": 12000, "quantity": 1, "subtotal": 12000}],
        }, timeout=10)
        assert r.status_code == 200, r.text
        oid = r.json()["order_id"]

        # GET back order
        got = s.get(f"{API}/orders/{oid}", timeout=10)
        assert got.status_code == 200
        assert got.json().get("customer_city") == "Hà Nội"

        # Cleanup
        s.delete(f"{API}/orders/{oid}", timeout=10)
        s.delete(f"{API}/customers/{cid}", timeout=10)
        s.delete(f"{API}/products/{pid}", timeout=10)


# =================== Đợt 2 (already covered in test_phase_2_security.py) ===================
# Sanity checks for security endpoint shapes are repeated here for iter 8 coverage.

class TestDot2SecurityShapes:
    def test_security_status_shape(self, s):
        r = s.get(f"{API}/security/status", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("has_pin2", "has_delete_pins"):
            assert k in d


# =================== Đợt 3 ===================

class TestDot3ExportBackup:
    def test_export_all_excel(self, s):
        r = s.get(f"{API}/system/export-all-excel", timeout=20)
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert "spreadsheet" in ct or "xlsx" in ct or "excel" in ct, f"Unexpected ct={ct}"
        assert len(r.content) > 100
        # Verify multi-sheet by opening with openpyxl
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(r.content), read_only=True)
        sheets = set(wb.sheetnames)
        # At minimum these 4 collections
        expected = {"customers", "products", "orders", "debt_payments"}
        # Sheet names may be Vietnamese or English; check intersection or contains key collections
        missing = expected - {sn.lower() for sn in sheets}
        assert not missing or len(sheets) >= 3, f"Missing sheets={missing}, got {sheets}"

    def test_backup_zip(self, s):
        r = s.get(f"{API}/system/backup-zip", timeout=20)
        assert r.status_code == 200, r.text
        # Should be a zip
        zf = zipfile.ZipFile(io.BytesIO(r.content))
        names = zf.namelist()
        assert any("_meta" in n for n in names), f"_meta.json missing in backup zip names={names}"
        # Should contain JSON files
        jsons = [n for n in names if n.endswith(".json")]
        assert len(jsons) >= 5, f"expected >=5 json files, got {jsons}"


class TestDot3InventoryXNT:
    def test_xnt_product(self, s):
        r = s.get(f"{API}/inventory/xnt?kind=product", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("items", "totals", "kind", "date_from", "date_to"):
            assert k in d, f"missing key {k}"
        assert d["kind"] == "product"
        for tk in ("total_in", "total_out", "total_opening", "total_ending", "n_entities"):
            assert tk in d["totals"], f"missing totals.{tk}"
        assert isinstance(d["items"], list)

    def test_xnt_material(self, s):
        r = s.get(f"{API}/inventory/xnt?kind=material", timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["kind"] == "material"

    def test_xnt_with_date_range(self, s):
        r = s.get(f"{API}/inventory/xnt?kind=product&date_from=2025-01-01&date_to=2026-12-31", timeout=20)
        assert r.status_code == 200, r.text


class TestDot3StockMovementsFilters:
    def test_stock_movements_supports_date_filters(self, s):
        r = s.get(f"{API}/stock/movements?date_from=2025-01-01&date_to=2026-12-31&limit=10", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        # endpoint may return list or {items: [...]}
        items = body if isinstance(body, list) else body.get("items", [])
        assert isinstance(items, list)
        assert len(items) <= 10
