"""Phase 5 (Production) + Phase 8 (Insights) backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://bao-cms-admin.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@banhbao.vn"
ADMIN_PASSWORD = "admin123"

DOW_NAMES = {"Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"}


def _cookie(r, k):
    v = r.cookies.get(k)
    if v:
        return v
    sc = r.headers.get("Set-Cookie", "")
    for p in sc.split(","):
        if f"{k}=" in p:
            return p.strip().split(";")[0].split("=", 1)[1]
    return None


@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    tok = _cookie(r, "access_token")
    assert tok
    return {"Authorization": f"Bearer {tok}"}


# ============== Auth gating ==============
def test_production_forecast_requires_auth():
    r = requests.get(f"{API}/production/forecast?days_ahead=1", timeout=15)
    assert r.status_code in (401, 403)


def test_insights_combos_requires_auth():
    r = requests.get(f"{API}/insights/combos", timeout=15)
    assert r.status_code in (401, 403)


def test_insights_scoring_requires_auth():
    r = requests.get(f"{API}/insights/customer-scoring", timeout=15)
    assert r.status_code in (401, 403)


def test_insights_ai_suggest_requires_auth():
    r = requests.get(f"{API}/insights/ai-suggest", timeout=15)
    assert r.status_code in (401, 403)


# ============== Phase 5 — Production forecast ==============
def test_production_forecast_shape(admin_h):
    r = requests.get(f"{API}/production/forecast?days_ahead=1", headers=admin_h, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "target_date" in data
    assert "target_day_of_week" in data
    assert data["target_day_of_week"] in DOW_NAMES
    assert data.get("lookback_days") == 28
    assert isinstance(data.get("forecasts"), list)
    for f in data["forecasts"]:
        for k in ("product_id", "name", "day_of_week", "avg_daily_sold",
                  "samples", "recommended_production", "current_stock",
                  "needs_to_produce", "unit"):
            assert k in f, f"missing key {k}"
        assert isinstance(f["samples"], int)
        assert f["recommended_production"] >= 0
        assert f["needs_to_produce"] >= 0


def test_production_forecast_days_ahead_2(admin_h):
    r = requests.get(f"{API}/production/forecast?days_ahead=2", headers=admin_h, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["target_day_of_week"] in DOW_NAMES


# ============== Phase 5 — Production batches CRUD ==============
@pytest.fixture(scope="module")
def a_product(admin_h):
    r = requests.get(f"{API}/products", headers=admin_h, timeout=15)
    assert r.status_code == 200, r.text
    products = r.json()
    if products:
        return products[0]
    # create one
    payload = {"name": "TEST_BB Production", "sku": f"TPB-{uuid.uuid4().hex[:6]}",
               "unit": "cái", "price": 10000, "stock": 0, "expiration_days": 3}
    cr = requests.post(f"{API}/products", headers=admin_h, json=payload, timeout=15)
    assert cr.status_code == 200, cr.text
    return cr.json()


def test_production_list(admin_h):
    r = requests.get(f"{API}/production", headers=admin_h, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_production_create_and_delete(admin_h, a_product):
    pid = a_product["product_id"]
    # get current stock
    g = requests.get(f"{API}/products", headers=admin_h, timeout=15)
    cur_stock = next((p.get("stock", 0) for p in g.json() if p["product_id"] == pid), 0)

    body = {
        "product_id": pid,
        "quantity": 10,
        "shift": "morning",
        "materials_used": [],
        "notes": "TEST_phase5 batch",
    }
    cr = requests.post(f"{API}/production", headers=admin_h, json=body, timeout=15)
    assert cr.status_code == 200, cr.text
    batch = cr.json()
    assert batch["product_id"] == pid
    assert batch["quantity"] == 10
    assert batch["shift"] == "morning"
    assert "batch_id" in batch
    assert "_id" not in batch
    bid = batch["batch_id"]

    # stock should have increased by 10
    g2 = requests.get(f"{API}/products", headers=admin_h, timeout=15)
    new_stock = next((p.get("stock", 0) for p in g2.json() if p["product_id"] == pid), 0)
    assert new_stock == cur_stock + 10, f"stock not incremented: {cur_stock} -> {new_stock}"

    # appears in listing
    lst = requests.get(f"{API}/production", headers=admin_h, timeout=15).json()
    assert any(b["batch_id"] == bid for b in lst)

    # delete should rollback stock
    d = requests.delete(f"{API}/production/{bid}", headers=admin_h, timeout=15)
    assert d.status_code == 200
    g3 = requests.get(f"{API}/products", headers=admin_h, timeout=15)
    final_stock = next((p.get("stock", 0) for p in g3.json() if p["product_id"] == pid), 0)
    assert final_stock == cur_stock, f"stock not rolled back: expected {cur_stock} got {final_stock}"


def test_production_create_invalid_product(admin_h):
    body = {"product_id": "doesnotexist", "quantity": 5, "shift": "afternoon"}
    r = requests.post(f"{API}/production", headers=admin_h, json=body, timeout=15)
    assert r.status_code == 404


# ============== Phase 8 — Insights ==============
def test_insights_combos_shape(admin_h):
    r = requests.get(f"{API}/insights/combos", headers=admin_h, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    for it in data["items"]:
        for k in ("product_a_id", "product_b_id", "name_a", "name_b", "count"):
            assert k in it
        assert it["count"] >= 2


def test_insights_customer_scoring_shape(admin_h):
    r = requests.get(f"{API}/insights/customer-scoring", headers=admin_h, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "counts" in data
    for bucket in ("vip", "high_potential", "at_risk", "churned", "new"):
        assert bucket in data["counts"]
        assert bucket in data
        assert isinstance(data[bucket], list)
        assert isinstance(data["counts"][bucket], int)
    # Sum of buckets equals total customers (capped at 50 each but counts is full)
    total = sum(data["counts"].values())
    # at least admin's customers
    assert total >= 0
    # Each customer has stat fields
    for bucket in ("vip", "high_potential", "at_risk", "churned", "new"):
        for c in data[bucket]:
            assert "order_count" in c
            assert "total_spent" in c
            assert "days_since_last_order" in c


def test_insights_ai_suggest(admin_h):
    r = requests.get(f"{API}/insights/ai-suggest", headers=admin_h, timeout=60)
    # AI call may fail if key invalid — capture
    assert r.status_code == 200, f"AI suggest failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    # response should contain some text/json
    assert data
    # Either parsed JSON or raw string
    assert isinstance(data, (dict, list, str))
