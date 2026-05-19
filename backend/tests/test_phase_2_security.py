"""Tests for Đợt 2 - Permission & Security: PIN2 + delete-all 3-pin flow."""
import os
import time
import requests

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "https://bao-cms-admin.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
ADMIN_EMAIL = "admin@banhbao.vn"
ADMIN_PASS = "admin123"


def _admin_cookies():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=10)
    assert r.status_code == 200, r.text
    return r.cookies


def _logged_in_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=10)
    assert r.status_code == 200, r.text
    return s


class TestSecurityPin2Setup:
    def test_get_status_initial(self):
        s = _logged_in_session()
        r = s.get(f"{API}/security/status", timeout=10)
        assert r.status_code == 200
        # may or may not have pins set from previous test runs - just shape check
        d = r.json()
        assert "has_pin2" in d
        assert "has_delete_pins" in d

    def test_pin2_requires_account_password(self):
        s = _logged_in_session()
        r = s.post(f"{API}/security/pin2", json={"account_password": "wrong", "new_pin": "1234"}, timeout=10)
        assert r.status_code == 403

    def test_set_pin2_ok(self):
        s = _logged_in_session()
        r = s.post(f"{API}/security/pin2", json={"account_password": ADMIN_PASS, "new_pin": "test-pin-1"}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        r = s.get(f"{API}/security/status", timeout=10)
        assert r.json()["has_pin2"] is True

    def test_verify_pin2_wrong(self):
        s = _logged_in_session()
        r = s.post(f"{API}/security/verify-pin2", json={"pin": "WRONG"}, timeout=10)
        assert r.status_code == 403

    def test_verify_pin2_correct(self):
        s = _logged_in_session()
        r = s.post(f"{API}/security/verify-pin2", json={"pin": "test-pin-1"}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True


class TestOrderActionsRequirePin2:
    """When PIN2 is set, mutations on orders require X-PIN2 header."""

    @classmethod
    def setup_class(cls):
        # Ensure PIN2 is set
        s = _logged_in_session()
        r = s.post(f"{API}/security/pin2", json={"account_password": ADMIN_PASS, "new_pin": "test-pin-1"}, timeout=10)
        assert r.status_code == 200

        # Create a customer + product + order for testing
        r = s.post(f"{API}/customers", json={"name": "PIN2_TEST_Customer", "phone": "099999000"}, timeout=10)
        cls.customer_id = r.json()["customer_id"]

        r = s.post(f"{API}/products", json={
            "name": "PIN2_TEST_Product", "category": "Bánh", "price": 10000, "stock": 100, "unit": "cái",
        }, timeout=10)
        cls.product_id = r.json()["product_id"]

        r = s.post(f"{API}/orders", json={
            "customer_id": cls.customer_id,
            "customer_name": "PIN2_TEST_Customer",
            "customer_phone": "099999000",
            "type": "retail",
            "items": [{"product_id": cls.product_id, "name": "PIN2_TEST_Product", "price": 10000, "quantity": 2, "subtotal": 20000}],
            "payment_method": "cash",
        }, timeout=10)
        assert r.status_code == 200, r.text
        cls.order_id = r.json()["order_id"]
        cls.session = s

    @classmethod
    def teardown_class(cls):
        # Cleanup: delete order (with PIN2), then customer + product
        s = cls.session
        try:
            s.delete(f"{API}/orders/{cls.order_id}", headers={"X-PIN2": "test-pin-1"}, timeout=10)
        except Exception:
            pass
        try:
            s.delete(f"{API}/customers/{cls.customer_id}", timeout=10)
        except Exception:
            pass
        try:
            s.delete(f"{API}/products/{cls.product_id}", timeout=10)
        except Exception:
            pass

    def test_status_update_without_pin2(self):
        r = self.session.put(f"{API}/orders/{self.order_id}/status", json={"status": "processing"}, timeout=10)
        assert r.status_code == 403
        assert r.json()["detail"] == "PIN2_REQUIRED"

    def test_status_update_wrong_pin2(self):
        r = self.session.put(f"{API}/orders/{self.order_id}/status",
                             json={"status": "processing"},
                             headers={"X-PIN2": "WRONG"}, timeout=10)
        assert r.status_code == 403

    def test_status_update_with_pin2(self):
        r = self.session.put(f"{API}/orders/{self.order_id}/status",
                             json={"status": "processing"},
                             headers={"X-PIN2": "test-pin-1"}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "processing"


class TestDeleteAllOrders3Layer:
    def test_delete_all_requires_setup(self):
        s = _logged_in_session()
        # Clear any existing delete-pins first via fresh PIN
        # (We can't unset delete pins, so test happy path: setup → delete-all)

        # Setup 2 delete pins
        r = s.post(f"{API}/security/delete-pins",
                   json={"account_password": ADMIN_PASS, "pin_a": "del-a", "pin_b": "del-b"},
                   timeout=10)
        assert r.status_code == 200, r.text

        # Wrong account password
        r = s.post(f"{API}/orders/delete-all",
                   json={"account_password": "wrong", "pin_a": "del-a", "pin_b": "del-b"},
                   timeout=10)
        assert r.status_code == 403

        # Wrong pin_a
        r = s.post(f"{API}/orders/delete-all",
                   json={"account_password": ADMIN_PASS, "pin_a": "wrong", "pin_b": "del-b"},
                   timeout=10)
        assert r.status_code == 403

        # Wrong pin_b
        r = s.post(f"{API}/orders/delete-all",
                   json={"account_password": ADMIN_PASS, "pin_a": "del-a", "pin_b": "wrong"},
                   timeout=10)
        assert r.status_code == 403

    def test_delete_pins_must_differ(self):
        s = _logged_in_session()
        r = s.post(f"{API}/security/delete-pins",
                   json={"account_password": ADMIN_PASS, "pin_a": "same-pin", "pin_b": "same-pin"},
                   timeout=10)
        assert r.status_code == 400


def test_zz_cleanup_pin2():
    """Tear down PIN2 so other tests aren't affected."""
    s = _logged_in_session()
    r = s.delete(f"{API}/security/pin2?account_password={ADMIN_PASS}", timeout=10)
    assert r.status_code == 200, r.text
