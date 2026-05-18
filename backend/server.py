from dotenv import load_dotenv
load_dotenv()

import os
import io
import uuid
import json
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal, Dict, Any

import bcrypt
import jwt
import requests
import pandas as pd
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient

from emergentintegrations.llm.chat import LlmChat, UserMessage

# ===========================================================================
# Setup
# ===========================================================================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("banhbao")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@banhbao.vn")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
SEED_DEMO = os.environ.get("SEED_DEMO", "false").lower() == "true"

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

app = FastAPI(title="Bánh Bao Admin API v2")
api = APIRouter(prefix="/api")

cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
if cors_origins_env.strip() == "*":
    cors_origins = ["*"]
    allow_credentials = False
else:
    cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===========================================================================
# Helpers
# ===========================================================================
ROLES = ("admin", "manager", "coordinator", "warehouse", "accountant", "shipper", "staff")

# Granular permission keys
PERMISSION_KEYS = (
    "orders.view", "orders.create", "orders.edit", "orders.delete", "orders.print",
    "products.view", "products.create", "products.edit", "products.delete",
    "materials.view", "materials.create", "materials.edit", "materials.delete",
    "stock.in", "stock.out", "stock.adjust",
    "customers.view", "customers.create", "customers.edit", "customers.delete", "customers.import",
    "suppliers.view", "suppliers.create", "suppliers.edit", "suppliers.delete",
    "debts.view", "debts.collect", "debts.pay", "debts.remind",
    "delivery.view", "delivery.assign", "delivery.bill",
    "reports.view", "reports.export",
    "users.view", "users.create", "users.edit", "users.delete",
    "settings.view", "settings.edit",
)

# Default permissions matrix per role
DEFAULT_PERMISSIONS: Dict[str, List[str]] = {
    "admin": list(PERMISSION_KEYS),  # full
    "manager": [k for k in PERMISSION_KEYS if not k.startswith("users.") and not k.startswith("settings.edit")] + ["settings.view"],
    "coordinator": [
        "orders.view", "orders.create", "orders.edit", "orders.print",
        "products.view", "customers.view", "customers.create", "customers.edit",
        "delivery.view", "delivery.assign", "delivery.bill",
        "debts.view", "reports.view",
    ],
    "warehouse": [
        "products.view", "products.create", "products.edit",
        "materials.view", "materials.create", "materials.edit",
        "stock.in", "stock.out", "stock.adjust",
        "suppliers.view", "suppliers.create", "suppliers.edit",
        "reports.view",
    ],
    "accountant": [
        "orders.view", "orders.print", "customers.view", "suppliers.view",
        "debts.view", "debts.collect", "debts.pay", "debts.remind",
        "reports.view", "reports.export",
    ],
    "shipper": [
        "orders.view", "delivery.view", "delivery.bill",
    ],
    "staff": [
        "orders.view", "orders.create", "products.view", "customers.view", "customers.create",
        "reports.view",
    ],
}


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def set_auth_cookies(resp: Response, access: str, refresh: str):
    resp.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=12*3600, path="/")
    resp.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=7*24*3600, path="/")


def clear_auth_cookies(resp: Response):
    for c in ("access_token", "refresh_token", "session_token"):
        resp.delete_cookie(c, path="/")


async def get_token_from_request(request: Request) -> Optional[str]:
    tok = request.cookies.get("access_token")
    if tok:
        return tok
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


async def get_current_user(request: Request) -> dict:
    token = await get_token_from_request(request)
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
            if payload.get("type") == "access":
                user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user
        except jwt.ExpiredSignatureError:
            pass
        except jwt.InvalidTokenError:
            pass

    session_token = request.cookies.get("session_token") or request.headers.get("X-Session-Token")
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if not expires_at or expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user

    raise HTTPException(status_code=401, detail="Not authenticated")


def get_user_permissions(user: dict) -> List[str]:
    """Custom permissions stored on user override the role default."""
    custom = user.get("permissions")
    if isinstance(custom, list) and custom:
        return custom
    return DEFAULT_PERMISSIONS.get(user.get("role", "staff"), DEFAULT_PERMISSIONS["staff"])


def require_role(*roles: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep


def require_permission(*keys: str):
    """Require ALL given permission keys (or admin role)."""
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") == "admin":
            return user
        perms = set(get_user_permissions(user))
        for k in keys:
            if k not in perms:
                raise HTTPException(status_code=403, detail=f"Missing permission: {k}")
        return user
    return dep


def _normalize_payment(method: Optional[str]) -> str:
    """Backwards-compat: 'cod' is renamed to 'debt'."""
    if method == "cod":
        return "debt"
    return method or "cash"


# ===========================================================================
# Models
# ===========================================================================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)
    role: Literal["admin", "manager", "coordinator", "warehouse", "accountant", "shipper", "staff"] = "staff"
    permissions: Optional[List[str]] = None
    phone: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["admin", "manager", "coordinator", "warehouse", "accountant", "shipper", "staff"]] = None
    permissions: Optional[List[str]] = None
    phone: Optional[str] = None
    payment_method: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class ProductIn(BaseModel):
    name: str
    sku: Optional[str] = None
    category: str = "Bánh bao"
    description: Optional[str] = ""
    price: float
    wholesale_price: float = 0
    cost: float = 0
    stock: int = 0
    low_stock_threshold: int = 10
    unit: str = "cái"
    image_url: Optional[str] = None
    variants: List[dict] = []
    is_active: bool = True


class MaterialIn(BaseModel):
    name: str
    code: Optional[str] = None
    unit: str = "kg"
    stock: float = 0
    cost: float = 0
    low_stock_threshold: float = 0
    expiration_days: int = 30  # default shelf life in days
    notes: Optional[str] = ""
    is_active: bool = True


class StockInIn(BaseModel):
    kind: Literal["material", "product"] = "material"
    target_id: str  # material_id or product_id
    quantity: float
    unit_price: float = 0
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = ""
    production_date: Optional[str] = None  # YYYY-MM-DD
    expiration_date: Optional[str] = None  # YYYY-MM-DD
    batch_code: Optional[str] = None
    notes: Optional[str] = ""


class StockAdjustIn(BaseModel):
    kind: Literal["material", "product"] = "product"
    target_id: str
    delta: float  # +/- adjustment
    reason: Literal["damage", "waste", "lost", "correction", "expired", "other"] = "correction"
    notes: Optional[str] = ""


class CustomerIn(BaseModel):
    name: str
    code: Optional[str] = ""
    nickname: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    district: Optional[str] = ""
    city: Optional[str] = ""
    tax_id: Optional[str] = ""  # MST or CCCD
    group: str = "new"  # vip/regular/new + custom tags
    type: Literal["retail", "wholesale"] = "retail"
    classification: Optional[str] = ""  # free-text custom tag
    assigned_user_id: Optional[str] = ""  # nhân viên phụ trách giao hàng
    max_debt_days: int = 0
    max_debt_amount: float = 0
    notes: Optional[str] = ""


class SupplierIn(BaseModel):
    name: str
    code: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    district: Optional[str] = ""
    city: Optional[str] = ""
    tax_id: Optional[str] = ""
    group: str = "default"
    rating: int = 5
    notes: Optional[str] = ""


class OrderItemIn(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    subtotal: float


class OrderIn(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    customer_phone: Optional[str] = ""
    customer_address: Optional[str] = ""
    customer_district: Optional[str] = ""
    type: Literal["retail", "wholesale", "delivery"] = "retail"
    items: List[OrderItemIn]
    payment_method: str = "cash"  # cash/transfer/debt/ewallet/card
    note: Optional[str] = ""
    discount: float = 0
    discount_percent: float = 0
    shipping_fee: float = 0
    assigned_shipper_id: Optional[str] = ""
    due_date: Optional[str] = ""  # YYYY-MM-DD for debt orders


class OrderStatusUpdate(BaseModel):
    status: Literal["new", "processing", "delivering", "delivered", "debt_pending", "cancelled"]
    note: Optional[str] = ""


class DebtPaymentIn(BaseModel):
    order_id: Optional[str] = None  # collect from customer order
    supplier_id: Optional[str] = None  # pay supplier
    customer_id: Optional[str] = None
    amount: float
    method: Literal["cash", "transfer", "ewallet", "card"] = "cash"
    notes: Optional[str] = ""


class ShopSettingsIn(BaseModel):
    shop_name: str = "Tiệm Bánh Bao"
    address: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    website: Optional[str] = ""
    tax_id: Optional[str] = ""
    bank_name: Optional[str] = ""
    bank_account: Optional[str] = ""
    bank_account_holder: Optional[str] = ""
    logo_url: Optional[str] = ""  # base64 or URL
    bill_show_logo: bool = True
    bill_show_address: bool = True
    bill_show_phone: bool = True
    bill_show_email: bool = False
    bill_show_website: bool = False
    bill_show_tax_id: bool = False
    bill_show_bank_qr: bool = True
    bill_footer_text: str = "Cảm ơn quý khách. Hẹn gặp lại!"
    default_language: Literal["vi", "en"] = "vi"


class ChatIn(BaseModel):
    session_id: str
    message: str
    model: Optional[str] = None  # "claude" | "openai" | provider:model


# ===========================================================================
# System
# ===========================================================================
@api.get("/system/time")
async def system_time():
    now = datetime.now(timezone.utc)
    return {
        "utc": now.isoformat(),
        "vn": (now + timedelta(hours=7)).isoformat(),
        "timestamp_ms": int(now.timestamp() * 1000),
        "timezone": "UTC (host)",
    }


@api.get("/system/permissions")
async def system_permissions(user: dict = Depends(get_current_user)):
    return {
        "roles": list(ROLES),
        "keys": list(PERMISSION_KEYS),
        "defaults": DEFAULT_PERMISSIONS,
        "mine": get_user_permissions(user),
    }


@api.post("/system/reset-demo")
async def reset_demo(confirm: str = Query(...), user: dict = Depends(require_role("admin"))):
    """Wipe all transactional data (orders, customers, suppliers, products, materials, debts, chat).
    Pass ?confirm=YES_DELETE to confirm. Keeps users and settings.
    """
    if confirm != "YES_DELETE":
        raise HTTPException(status_code=400, detail="Pass confirm=YES_DELETE to proceed")
    collections = [
        "orders", "customers", "suppliers", "products", "materials",
        "stock_movements", "debt_payments", "chat_messages",
    ]
    counts = {}
    for c in collections:
        res = await db[c].delete_many({})
        counts[c] = res.deleted_count
    return {"ok": True, "deleted": counts}


# ===========================================================================
# Auth
# ===========================================================================
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email đã tồn tại")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id, "email": email, "name": body.name, "role": body.role,
        "phone": body.phone or "",
        "password_hash": hash_password(body.password),
        "auth_provider": "local",
        "is_active": True,
        "permissions": body.permissions if body.permissions is not None else None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    access = create_access_token(user_id, email, body.role)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until and locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Quá nhiều lần thử. Thử lại sau 15 phút.")

    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": datetime.now(timezone.utc) + timedelta(minutes=15)}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")

    if user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")

    await db.login_attempts.delete_one({"identifier": identifier})
    access = create_access_token(user["user_id"], email, user.get("role", "staff"))
    refresh = create_refresh_token(user["user_id"])
    set_auth_cookies(response, access, refresh)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return user


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    user["permissions_effective"] = get_user_permissions(user)
    return user


@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(rt, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        new_access = create_access_token(user["user_id"], user["email"], user.get("role", "staff"))
        response.set_cookie("access_token", new_access, httponly=True, secure=True, samesite="none", max_age=12*3600, path="/")
        return {"ok": True}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@api.post("/auth/session")
async def emergent_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID") or (await request.json()).get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")
    try:
        r = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}, timeout=10,
        )
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Auth service error: {e}")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()
    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data["session_token"]

    user = await db.users.find_one({"email": email})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id, "email": email, "name": name, "picture": picture,
            "role": "staff", "auth_provider": "google", "is_active": True,
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture, "auth_provider": user.get("auth_provider", "google")}},
        )

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token, "user_id": user["user_id"],
            "expires_at": expires_at, "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    response.set_cookie("session_token", session_token, httponly=True, secure=True, samesite="none", max_age=7*24*3600, path="/")
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


# ===========================================================================
# Settings
# ===========================================================================
SETTINGS_ID = "shop_settings_singleton"


@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"_singleton": SETTINGS_ID}, {"_id": 0, "_singleton": 0})
    if not s:
        # return defaults
        defaults = ShopSettingsIn().model_dump()
        return defaults
    return s


@api.put("/settings")
async def update_settings(body: ShopSettingsIn, user: dict = Depends(require_permission("settings.edit"))):
    doc = body.model_dump()
    doc["updated_at"] = datetime.now(timezone.utc)
    await db.settings.update_one({"_singleton": SETTINGS_ID}, {"$set": doc, "$setOnInsert": {"_singleton": SETTINGS_ID}}, upsert=True)
    out = dict(doc)
    return out


# ===========================================================================
# Dashboard
# ===========================================================================
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    today_orders = await db.orders.find(
        {"created_at": {"$gte": today_start}}, {"_id": 0, "total": 1, "status": 1}
    ).limit(2000).to_list(None)
    today_revenue = sum(o.get("total", 0) for o in today_orders if o.get("status") != "cancelled")

    total_products = await db.products.count_documents({"is_active": True})
    total_customers = await db.customers.count_documents({})

    debt_orders = await db.orders.find(
        {"payment_method": "debt", "status": {"$ne": "cancelled"}, "is_paid": {"$ne": True}},
        {"_id": 0, "total": 1},
    ).limit(1000).to_list(None)
    total_debt = sum(o.get("total", 0) for o in debt_orders)

    chart = []
    for i in range(6, -1, -1):
        day = today_start - timedelta(days=i)
        day_end = day + timedelta(days=1)
        day_orders = await db.orders.find(
            {"created_at": {"$gte": day, "$lt": day_end}, "status": {"$ne": "cancelled"}},
            {"_id": 0, "total": 1},
        ).limit(1000).to_list(None)
        chart.append({
            "date": day.strftime("%d/%m"),
            "revenue": sum(o.get("total", 0) for o in day_orders),
            "orders": len(day_orders),
        })

    low_stock = await db.products.find(
        {"$expr": {"$lte": ["$stock", "$low_stock_threshold"]}, "is_active": True}, {"_id": 0},
    ).sort("stock", 1).limit(8).to_list(None)

    recent_orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(6).to_list(None)

    pipeline = [
        {"$match": {"status": {"$ne": "cancelled"}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.product_id",
            "name": {"$first": "$items.name"},
            "quantity": {"$sum": "$items.quantity"},
            "revenue": {"$sum": "$items.subtotal"},
        }},
        {"$sort": {"quantity": -1}},
        {"$limit": 5},
    ]
    top_products = []
    async for r in db.orders.aggregate(pipeline):
        top_products.append({
            "product_id": r["_id"], "name": r["name"],
            "quantity": r["quantity"], "revenue": r["revenue"],
        })

    # Customers who haven't ordered for 14+ days
    cutoff = today_start - timedelta(days=14)
    inactive_pipeline = [
        {"$group": {"_id": "$customer_id", "last_order": {"$max": "$created_at"}}},
        {"$match": {"last_order": {"$lt": cutoff}}},
        {"$count": "n"},
    ]
    inactive_count = 0
    async for r in db.orders.aggregate(inactive_pipeline):
        inactive_count = r["n"]

    # Materials low stock count
    mat_low = await db.materials.count_documents({"$expr": {"$lte": ["$stock", "$low_stock_threshold"]}, "is_active": True})

    return {
        "today_revenue": today_revenue,
        "today_orders": len(today_orders),
        "total_debt": total_debt,
        "total_products": total_products,
        "total_customers": total_customers,
        "inactive_customers_14d": inactive_count,
        "low_stock_materials": mat_low,
        "chart_7days": chart,
        "low_stock_products": low_stock,
        "recent_orders": recent_orders,
        "top_products": top_products,
    }


# ===========================================================================
# Products
# ===========================================================================
@api.get("/products")
async def list_products(
    q: Optional[str] = None,
    category: Optional[str] = None,
    low_stock: bool = False,
    sort: str = "created_at",
    direction: Literal["asc", "desc"] = "desc",
    user: dict = Depends(get_current_user),
):
    query = {}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"sku": {"$regex": q, "$options": "i"}}]
    if category:
        query["category"] = category
    if low_stock:
        query["$expr"] = {"$lte": ["$stock", "$low_stock_threshold"]}
    dirv = 1 if direction == "asc" else -1
    items = await db.products.find(query, {"_id": 0}).sort(sort, dirv).limit(500).to_list(None)
    return items


@api.post("/products")
async def create_product(body: ProductIn, user: dict = Depends(require_permission("products.create"))):
    doc = body.model_dump()
    doc["product_id"] = f"prd_{uuid.uuid4().hex[:10]}"
    doc["sku"] = doc.get("sku") or doc["product_id"].upper()
    doc["created_at"] = datetime.now(timezone.utc)
    doc["updated_at"] = doc["created_at"]
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductIn, user: dict = Depends(require_permission("products.edit"))):
    upd = body.model_dump()
    upd["updated_at"] = datetime.now(timezone.utc)
    res = await db.products.update_one({"product_id": product_id}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
    return await db.products.find_one({"product_id": product_id}, {"_id": 0})


@api.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(require_permission("products.delete"))):
    res = await db.products.delete_one({"product_id": product_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
    return {"ok": True}


# ===========================================================================
# Raw Materials (NVL)
# ===========================================================================
@api.get("/materials")
async def list_materials(
    q: Optional[str] = None,
    low_stock: bool = False,
    sort: str = "created_at",
    direction: Literal["asc", "desc"] = "desc",
    user: dict = Depends(require_permission("materials.view")),
):
    query = {}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"code": {"$regex": q, "$options": "i"}}]
    if low_stock:
        query["$expr"] = {"$lte": ["$stock", "$low_stock_threshold"]}
    dirv = 1 if direction == "asc" else -1
    items = await db.materials.find(query, {"_id": 0}).sort(sort, dirv).limit(500).to_list(None)
    return items


@api.post("/materials")
async def create_material(body: MaterialIn, user: dict = Depends(require_permission("materials.create"))):
    doc = body.model_dump()
    doc["material_id"] = f"mat_{uuid.uuid4().hex[:10]}"
    doc["code"] = doc.get("code") or doc["material_id"].upper()
    doc["created_at"] = datetime.now(timezone.utc)
    doc["updated_at"] = doc["created_at"]
    await db.materials.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/materials/{material_id}")
async def update_material(material_id: str, body: MaterialIn, user: dict = Depends(require_permission("materials.edit"))):
    upd = body.model_dump()
    upd["updated_at"] = datetime.now(timezone.utc)
    res = await db.materials.update_one({"material_id": material_id}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy NVL")
    return await db.materials.find_one({"material_id": material_id}, {"_id": 0})


@api.delete("/materials/{material_id}")
async def delete_material(material_id: str, user: dict = Depends(require_permission("materials.delete"))):
    res = await db.materials.delete_one({"material_id": material_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy NVL")
    return {"ok": True}


# ===========================================================================
# Stock movements (in / out / adjust) - FIFO + Expiration
# ===========================================================================
@api.post("/stock/in")
async def stock_in(body: StockInIn, user: dict = Depends(require_permission("stock.in"))):
    now = datetime.now(timezone.utc)
    coll = "materials" if body.kind == "material" else "products"
    id_field = "material_id" if body.kind == "material" else "product_id"
    target = await db[coll].find_one({id_field: body.target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục nhập kho")

    # parse dates
    prod_date = None
    exp_date = None
    try:
        if body.production_date:
            prod_date = datetime.fromisoformat(body.production_date).replace(tzinfo=timezone.utc)
        if body.expiration_date:
            exp_date = datetime.fromisoformat(body.expiration_date).replace(tzinfo=timezone.utc)
        elif prod_date and body.kind == "material":
            exp_date = prod_date + timedelta(days=int(target.get("expiration_days", 30)))
    except Exception:
        prod_date = None
        exp_date = None

    movement = {
        "movement_id": f"mov_{uuid.uuid4().hex[:10]}",
        "kind": body.kind, "target_id": body.target_id, "target_name": target.get("name"),
        "type": "in",
        "quantity": body.quantity,
        "remaining": body.quantity,  # for FIFO
        "unit_price": body.unit_price,
        "subtotal": body.unit_price * body.quantity,
        "supplier_id": body.supplier_id, "supplier_name": body.supplier_name,
        "production_date": prod_date,
        "expiration_date": exp_date,
        "batch_code": body.batch_code or f"BATCH-{now.strftime('%y%m%d%H%M')}",
        "notes": body.notes,
        "created_at": now, "created_by": user.get("name", "system"), "created_by_id": user["user_id"],
    }
    await db.stock_movements.insert_one(movement)
    await db[coll].update_one({id_field: body.target_id}, {"$inc": {"stock": body.quantity}})
    movement.pop("_id", None)
    return movement


@api.post("/stock/adjust")
async def stock_adjust(body: StockAdjustIn, user: dict = Depends(require_permission("stock.adjust"))):
    now = datetime.now(timezone.utc)
    coll = "materials" if body.kind == "material" else "products"
    id_field = "material_id" if body.kind == "material" else "product_id"
    target = await db[coll].find_one({id_field: body.target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy")

    movement = {
        "movement_id": f"mov_{uuid.uuid4().hex[:10]}",
        "kind": body.kind, "target_id": body.target_id, "target_name": target.get("name"),
        "type": "adjust",
        "quantity": body.delta,
        "reason": body.reason,
        "notes": body.notes,
        "created_at": now, "created_by": user.get("name", "system"), "created_by_id": user["user_id"],
    }
    await db.stock_movements.insert_one(movement)
    await db[coll].update_one({id_field: body.target_id}, {"$inc": {"stock": body.delta}})
    movement.pop("_id", None)
    return movement


@api.get("/stock/movements")
async def list_movements(
    kind: Optional[str] = None, target_id: Optional[str] = None,
    type: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q = {}
    if kind:
        q["kind"] = kind
    if target_id:
        q["target_id"] = target_id
    if type:
        q["type"] = type
    items = await db.stock_movements.find(q, {"_id": 0}).sort("created_at", -1).limit(500).to_list(None)
    return items


@api.get("/stock/expiring")
async def expiring_soon(days: int = 7, user: dict = Depends(get_current_user)):
    """Materials/products expiring within N days."""
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=days)
    items = await db.stock_movements.find(
        {"type": "in", "expiration_date": {"$ne": None, "$lte": cutoff}, "remaining": {"$gt": 0}},
        {"_id": 0},
    ).sort("expiration_date", 1).limit(200).to_list(None)
    return items


# ===========================================================================
# Customers
# ===========================================================================
@api.get("/customers")
async def list_customers(
    q: Optional[str] = None,
    group: Optional[str] = None,
    type: Optional[str] = None,
    district: Optional[str] = None,
    classification: Optional[str] = None,
    sort: str = "created_at",
    direction: Literal["asc", "desc"] = "desc",
    user: dict = Depends(require_permission("customers.view")),
):
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"nickname": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"code": {"$regex": q, "$options": "i"}},
        ]
    if group:
        query["group"] = group
    if type:
        query["type"] = type
    if district:
        query["district"] = district
    if classification:
        query["classification"] = classification
    dirv = 1 if direction == "asc" else -1
    items = await db.customers.find(query, {"_id": 0}).sort(sort, dirv).limit(2000).to_list(None)
    return items


def _gen_customer_code() -> str:
    return f"KH{datetime.now(timezone.utc).strftime('%y%m')}{uuid.uuid4().hex[:4].upper()}"


@api.post("/customers")
async def create_customer(body: CustomerIn, user: dict = Depends(require_permission("customers.create"))):
    doc = body.model_dump()
    doc["customer_id"] = f"cus_{uuid.uuid4().hex[:10]}"
    doc["code"] = doc.get("code") or _gen_customer_code()
    doc["created_at"] = datetime.now(timezone.utc)
    doc["total_orders"] = 0
    doc["total_spent"] = 0.0
    doc["last_order_at"] = None
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/customers/{customer_id}")
async def update_customer(customer_id: str, body: CustomerIn, user: dict = Depends(require_permission("customers.edit"))):
    upd = body.model_dump()
    res = await db.customers.update_one({"customer_id": customer_id}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
    return await db.customers.find_one({"customer_id": customer_id}, {"_id": 0})


@api.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, user: dict = Depends(require_permission("customers.delete"))):
    res = await db.customers.delete_one({"customer_id": customer_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy")
    return {"ok": True}


@api.get("/customers/care")
async def customer_care(days: int = 14, user: dict = Depends(require_permission("customers.view"))):
    """List customers who haven't ordered in N+ days, plus all customers sorted by last order desc (those who ordered up top)."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    customers = await db.customers.find({}, {"_id": 0}).limit(2000).to_list(None)

    pipeline = [
        {"$match": {"customer_id": {"$ne": None}}},
        {"$group": {
            "_id": "$customer_id",
            "last_order": {"$max": "$created_at"},
            "order_count": {"$sum": 1},
            "total_spent": {"$sum": "$total"},
        }},
    ]
    last_orders = {}
    async for r in db.orders.aggregate(pipeline):
        last_orders[r["_id"]] = r

    # Build enriched list
    enriched = []
    for c in customers:
        lo = last_orders.get(c["customer_id"], {})
        enriched.append({
            **c,
            "last_order": lo.get("last_order"),
            "order_count": lo.get("order_count", 0),
            "total_spent_agg": lo.get("total_spent", 0),
            "needs_care": (lo.get("last_order") is None) or (lo.get("last_order") and lo["last_order"] < cutoff),
        })

    # Sort: ones who ordered (recently) first, then those needing care
    enriched.sort(key=lambda x: (x["last_order"] is None, -(x["last_order"].timestamp() if x["last_order"] else 0)))

    return {
        "items": enriched,
        "total": len(enriched),
        "needs_care_count": sum(1 for x in enriched if x["needs_care"]),
        "cutoff_days": days,
    }


@api.get("/customers/export")
async def export_customers(user: dict = Depends(require_permission("customers.view"))):
    """Export all customers to Excel."""
    customers = await db.customers.find({}, {"_id": 0}).limit(5000).to_list(None)
    df = pd.DataFrame(customers if customers else [{}])
    # Reorder columns for readability
    preferred = ["code", "name", "nickname", "phone", "email", "address", "district", "city",
                 "tax_id", "group", "type", "classification", "max_debt_days", "max_debt_amount",
                 "total_orders", "total_spent", "notes"]
    cols = [c for c in preferred if c in df.columns] + [c for c in df.columns if c not in preferred and c not in ("customer_id", "created_at", "assigned_user_id")]
    if cols:
        df = df[cols]
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="customers")
    buf.seek(0)
    fname = f"customers-{datetime.now().strftime('%Y%m%d-%H%M')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api.get("/customers/import-template")
async def customer_import_template(user: dict = Depends(require_permission("customers.import"))):
    """Download Excel template for customer import."""
    sample = [{
        "code": "KH001",
        "name": "Nguyễn Văn A",
        "nickname": "Anh A",
        "phone": "0901234567",
        "email": "a@email.com",
        "address": "123 Lê Lợi",
        "district": "Quận 1",
        "city": "TP.HCM",
        "tax_id": "",
        "group": "regular",
        "type": "retail",
        "classification": "",
        "max_debt_days": 0,
        "max_debt_amount": 0,
        "notes": "",
    }]
    df = pd.DataFrame(sample)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="customers")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="customers-template.xlsx"'},
    )


@api.post("/customers/import")
async def import_customers(file: UploadFile = File(...), user: dict = Depends(require_permission("customers.import"))):
    raw = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(raw))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File không đọc được: {e}")
    inserted = 0
    skipped = 0
    errors: List[str] = []
    now = datetime.now(timezone.utc)
    for idx, row in df.iterrows():
        try:
            name = str(row.get("name", "")).strip()
            if not name or name.lower() == "nan":
                skipped += 1
                continue
            code_v = row.get("code")
            phone_v = row.get("phone")
            doc = {
                "customer_id": f"cus_{uuid.uuid4().hex[:10]}",
                "code": str(code_v).strip() if pd.notna(code_v) and str(code_v).strip() else _gen_customer_code(),
                "name": name,
                "nickname": str(row.get("nickname") or "").strip(),
                "phone": str(phone_v).strip() if pd.notna(phone_v) else "",
                "email": str(row.get("email") or "").strip(),
                "address": str(row.get("address") or "").strip(),
                "district": str(row.get("district") or "").strip(),
                "city": str(row.get("city") or "").strip(),
                "tax_id": str(row.get("tax_id") or "").strip(),
                "group": str(row.get("group") or "new").strip().lower(),
                "type": str(row.get("type") or "retail").strip().lower(),
                "classification": str(row.get("classification") or "").strip(),
                "assigned_user_id": "",
                "max_debt_days": int(float(row.get("max_debt_days") or 0)),
                "max_debt_amount": float(row.get("max_debt_amount") or 0),
                "notes": str(row.get("notes") or "").strip(),
                "total_orders": 0,
                "total_spent": 0.0,
                "last_order_at": None,
                "created_at": now,
            }
            # Skip if a customer with same name+phone already exists
            existing = await db.customers.find_one({"name": doc["name"], "phone": doc["phone"]})
            if existing:
                skipped += 1
                continue
            await db.customers.insert_one(doc)
            inserted += 1
        except Exception as e:
            errors.append(f"Dòng {idx + 2}: {e}")
    return {"inserted": inserted, "skipped": skipped, "errors": errors[:10]}


# ===========================================================================
# Suppliers
# ===========================================================================
@api.get("/suppliers")
async def list_suppliers(
    q: Optional[str] = None, group: Optional[str] = None,
    sort: str = "created_at", direction: Literal["asc", "desc"] = "desc",
    user: dict = Depends(require_permission("suppliers.view")),
):
    query = {}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"phone": {"$regex": q, "$options": "i"}}]
    if group:
        query["group"] = group
    dirv = 1 if direction == "asc" else -1
    items = await db.suppliers.find(query, {"_id": 0}).sort(sort, dirv).limit(500).to_list(None)
    return items


@api.post("/suppliers")
async def create_supplier(body: SupplierIn, user: dict = Depends(require_permission("suppliers.create"))):
    doc = body.model_dump()
    doc["supplier_id"] = f"sup_{uuid.uuid4().hex[:10]}"
    doc["code"] = doc.get("code") or f"NCC{datetime.now(timezone.utc).strftime('%y%m')}{uuid.uuid4().hex[:4].upper()}"
    doc["created_at"] = datetime.now(timezone.utc)
    doc["total_debt"] = 0
    await db.suppliers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, body: SupplierIn, user: dict = Depends(require_permission("suppliers.edit"))):
    upd = body.model_dump()
    res = await db.suppliers.update_one({"supplier_id": supplier_id}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy NCC")
    return await db.suppliers.find_one({"supplier_id": supplier_id}, {"_id": 0})


@api.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, user: dict = Depends(require_permission("suppliers.delete"))):
    res = await db.suppliers.delete_one({"supplier_id": supplier_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy NCC")
    return {"ok": True}


# ===========================================================================
# Orders
# ===========================================================================
def _generate_order_code() -> str:
    return f"BB{datetime.now(timezone.utc).strftime('%y%m%d')}{uuid.uuid4().hex[:4].upper()}"


@api.get("/orders")
async def list_orders(
    q: Optional[str] = None,
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    type: Optional[str] = None,
    district: Optional[str] = None,
    shipper_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort: str = "created_at",
    direction: Literal["asc", "desc"] = "desc",
    user: dict = Depends(require_permission("orders.view")),
):
    query = {}
    if q:
        query["$or"] = [
            {"order_code": {"$regex": q, "$options": "i"}},
            {"customer_name": {"$regex": q, "$options": "i"}},
            {"customer_phone": {"$regex": q, "$options": "i"}},
        ]
    if status:
        query["status"] = status
    if payment_method:
        pm = _normalize_payment(payment_method)
        query["payment_method"] = pm
    if type:
        query["type"] = type
    if district:
        query["customer_district"] = district
    if shipper_id:
        query["assigned_shipper_id"] = shipper_id
    date_q = {}
    if date_from:
        date_q["$gte"] = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
    if date_to:
        date_q["$lte"] = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc) + timedelta(days=1)
    if date_q:
        query["created_at"] = date_q

    dirv = 1 if direction == "asc" else -1
    items = await db.orders.find(query, {"_id": 0}).sort(sort, dirv).limit(500).to_list(None)
    return items


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(require_permission("orders.view"))):
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    return o


@api.post("/orders")
async def create_order(body: OrderIn, user: dict = Depends(require_permission("orders.create"))):
    items = [it.model_dump() for it in body.items]
    subtotal = sum(it["subtotal"] for it in items)
    percent_discount = round(subtotal * (body.discount_percent or 0) / 100, 2)
    total = subtotal - body.discount - percent_discount + body.shipping_fee

    payment = _normalize_payment(body.payment_method)
    due_date = None
    if body.due_date:
        try:
            due_date = datetime.fromisoformat(body.due_date).replace(tzinfo=timezone.utc)
        except Exception:
            due_date = None
    # If debt + customer has max_debt_days set, compute default due date
    if not due_date and payment == "debt" and body.customer_id:
        c = await db.customers.find_one({"customer_id": body.customer_id})
        if c and c.get("max_debt_days"):
            due_date = datetime.now(timezone.utc) + timedelta(days=int(c["max_debt_days"]))

    order_id = f"ord_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    doc = {
        "order_id": order_id,
        "order_code": _generate_order_code(),
        "customer_id": body.customer_id,
        "customer_name": body.customer_name,
        "customer_phone": body.customer_phone,
        "customer_address": body.customer_address,
        "customer_district": body.customer_district,
        "type": body.type,
        "items": items,
        "subtotal": subtotal,
        "discount": body.discount,
        "discount_percent": body.discount_percent,
        "discount_amount": body.discount + percent_discount,
        "shipping_fee": body.shipping_fee,
        "total": total,
        "paid_amount": 0,
        "remaining_amount": total if payment == "debt" else 0,
        "payment_method": payment,
        "is_paid": payment in ("cash", "transfer", "card", "ewallet"),
        "status": "new",
        "due_date": due_date,
        "assigned_shipper_id": body.assigned_shipper_id or None,
        "note": body.note,
        "timeline": [{
            "status": "new", "at": now,
            "by": user.get("name", "system"), "note": "Tạo đơn hàng mới",
        }],
        "created_at": now, "created_by": user["user_id"], "updated_at": now,
    }
    await db.orders.insert_one(doc)

    for it in items:
        await db.products.update_one(
            {"product_id": it["product_id"]}, {"$inc": {"stock": -it["quantity"]}},
        )
    if body.customer_id:
        await db.customers.update_one(
            {"customer_id": body.customer_id},
            {"$inc": {"total_orders": 1, "total_spent": total}, "$set": {"last_order_at": now}},
        )

    doc.pop("_id", None)
    return doc


@api.post("/orders/{order_id}/duplicate")
async def duplicate_order(order_id: str, user: dict = Depends(require_permission("orders.create"))):
    """Copy an existing order and create a new one with current date."""
    src = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not src:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng gốc")
    now = datetime.now(timezone.utc)
    new_id = f"ord_{uuid.uuid4().hex[:12]}"
    doc = {
        **src,
        "order_id": new_id,
        "order_code": _generate_order_code(),
        "status": "new",
        "paid_amount": 0,
        "is_paid": src.get("payment_method") in ("cash", "transfer", "card", "ewallet"),
        "remaining_amount": src.get("total", 0) if src.get("payment_method") == "debt" else 0,
        "timeline": [{
            "status": "new", "at": now,
            "by": user.get("name", "system"),
            "note": f"Nhân bản từ đơn {src.get('order_code')}",
        }],
        "created_at": now, "created_by": user["user_id"], "updated_at": now,
    }
    await db.orders.insert_one(doc)
    # Decrement stock
    for it in doc.get("items", []):
        await db.products.update_one(
            {"product_id": it["product_id"]}, {"$inc": {"stock": -it["quantity"]}},
        )
    if doc.get("customer_id"):
        await db.customers.update_one(
            {"customer_id": doc["customer_id"]},
            {"$inc": {"total_orders": 1, "total_spent": doc.get("total", 0)}, "$set": {"last_order_at": now}},
        )
    doc.pop("_id", None)
    return doc


@api.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusUpdate, user: dict = Depends(require_permission("orders.edit"))):
    o = await db.orders.find_one({"order_id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    now = datetime.now(timezone.utc)
    entry = {"status": body.status, "at": now, "by": user.get("name", "system"), "note": body.note or ""}
    update = {"$set": {"status": body.status, "updated_at": now}, "$push": {"timeline": entry}}
    if body.status == "delivered":
        if o.get("payment_method") != "debt":
            update["$set"]["is_paid"] = True
    if body.status == "cancelled":
        for it in o.get("items", []):
            await db.products.update_one(
                {"product_id": it["product_id"]}, {"$inc": {"stock": it["quantity"]}},
            )
    await db.orders.update_one({"order_id": order_id}, update)
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


@api.put("/orders/{order_id}/assign-shipper")
async def assign_shipper(order_id: str, shipper_id: str = Query(...), user: dict = Depends(require_permission("delivery.assign"))):
    shipper = await db.users.find_one({"user_id": shipper_id})
    if not shipper:
        raise HTTPException(status_code=404, detail="Shipper không tồn tại")
    res = await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"assigned_shipper_id": shipper_id, "assigned_shipper_name": shipper.get("name")}},
    )
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


@api.delete("/orders/{order_id}")
async def delete_order(order_id: str, user: dict = Depends(require_permission("orders.delete"))):
    o = await db.orders.find_one({"order_id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Không tìm thấy")
    if o.get("status") != "cancelled":
        for it in o.get("items", []):
            await db.products.update_one(
                {"product_id": it["product_id"]}, {"$inc": {"stock": it["quantity"]}},
            )
    await db.orders.delete_one({"order_id": order_id})
    return {"ok": True}


# ===========================================================================
# Debts
# ===========================================================================
@api.get("/debts/customers")
async def debts_customers(user: dict = Depends(require_permission("debts.view"))):
    """Aggregated customer debt with overdue/due classification."""
    now = datetime.now(timezone.utc)
    pipeline = [
        {"$match": {"payment_method": "debt", "is_paid": {"$ne": True}, "status": {"$ne": "cancelled"}}},
        {"$group": {
            "_id": {"customer_id": "$customer_id", "customer_name": "$customer_name"},
            "phone": {"$first": "$customer_phone"},
            "total_debt": {"$sum": "$remaining_amount"},
            "order_count": {"$sum": 1},
            "min_due": {"$min": "$due_date"},
            "max_due": {"$max": "$due_date"},
            "last_order": {"$max": "$created_at"},
        }},
        {"$sort": {"total_debt": -1}},
        {"$limit": 500},
    ]
    items = []
    async for r in db.orders.aggregate(pipeline):
        min_due = r.get("min_due")
        max_due = r.get("max_due")
        overdue = False
        due_soon = False
        if min_due:
            if min_due.tzinfo is None:
                min_due = min_due.replace(tzinfo=timezone.utc)
            if min_due < now:
                overdue = True
            elif min_due < now + timedelta(days=3):
                due_soon = True
        items.append({
            "customer_id": r["_id"]["customer_id"],
            "customer_name": r["_id"]["customer_name"],
            "phone": r.get("phone"),
            "total_debt": r["total_debt"],
            "order_count": r["order_count"],
            "earliest_due": min_due,
            "latest_due": max_due,
            "last_order": r.get("last_order"),
            "overdue": overdue,
            "due_soon": due_soon,
        })
    total = sum(i["total_debt"] for i in items)
    overdue_total = sum(i["total_debt"] for i in items if i["overdue"])
    due_soon_total = sum(i["total_debt"] for i in items if i["due_soon"])
    return {
        "items": items,
        "total": total,
        "overdue_total": overdue_total,
        "due_soon_total": due_soon_total,
    }


@api.get("/debts/customers/{customer_id}/orders")
async def customer_debt_orders(customer_id: str, user: dict = Depends(require_permission("debts.view"))):
    """All unpaid debt orders for a customer with detail."""
    now = datetime.now(timezone.utc)
    orders = await db.orders.find(
        {"customer_id": customer_id, "payment_method": "debt", "is_paid": {"$ne": True}, "status": {"$ne": "cancelled"}},
        {"_id": 0},
    ).sort("created_at", -1).limit(200).to_list(None)
    for o in orders:
        due = o.get("due_date")
        if due:
            if isinstance(due, str):
                try:
                    due = datetime.fromisoformat(due.replace("Z", "+00:00"))
                except Exception:
                    due = None
            if due and due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            if due:
                delta = (due - now).days
                o["days_to_due"] = delta
                o["overdue"] = delta < 0
                o["due_soon"] = 0 <= delta <= 3
    return orders


@api.post("/debts/collect")
async def debts_collect(body: DebtPaymentIn, user: dict = Depends(require_permission("debts.collect"))):
    """Customer pays (partially or fully) on a debt order."""
    if not body.order_id:
        raise HTTPException(status_code=400, detail="order_id is required")
    o = await db.orders.find_one({"order_id": body.order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    remaining = o.get("remaining_amount", o.get("total", 0)) - body.amount
    is_paid = remaining <= 0
    update = {
        "$set": {
            "remaining_amount": max(0, remaining),
            "paid_amount": o.get("paid_amount", 0) + body.amount,
            "is_paid": is_paid,
        }
    }
    await db.orders.update_one({"order_id": body.order_id}, update)
    now = datetime.now(timezone.utc)
    payment = {
        "payment_id": f"pmt_{uuid.uuid4().hex[:10]}",
        "direction": "in",  # money coming IN from customer
        "order_id": body.order_id,
        "customer_id": o.get("customer_id"),
        "customer_name": o.get("customer_name"),
        "amount": body.amount,
        "method": body.method,
        "notes": body.notes,
        "created_at": now, "created_by": user.get("name"), "created_by_id": user["user_id"],
    }
    await db.debt_payments.insert_one(payment)
    payment.pop("_id", None)
    return {"order": await db.orders.find_one({"order_id": body.order_id}, {"_id": 0}), "payment": payment}


@api.post("/debts/pay-supplier")
async def debts_pay_supplier(body: DebtPaymentIn, user: dict = Depends(require_permission("debts.pay"))):
    if not body.supplier_id:
        raise HTTPException(status_code=400, detail="supplier_id is required")
    supplier = await db.suppliers.find_one({"supplier_id": body.supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Không tìm thấy NCC")
    now = datetime.now(timezone.utc)
    payment = {
        "payment_id": f"pmt_{uuid.uuid4().hex[:10]}",
        "direction": "out",
        "supplier_id": body.supplier_id, "supplier_name": supplier.get("name"),
        "amount": body.amount, "method": body.method, "notes": body.notes,
        "created_at": now, "created_by": user.get("name"), "created_by_id": user["user_id"],
    }
    await db.debt_payments.insert_one(payment)
    # decrement supplier debt counter
    await db.suppliers.update_one({"supplier_id": body.supplier_id}, {"$inc": {"total_debt": -body.amount}})
    payment.pop("_id", None)
    return payment


@api.get("/debts/payments")
async def list_debt_payments(
    direction: Optional[str] = None,
    customer_id: Optional[str] = None,
    supplier_id: Optional[str] = None,
    user: dict = Depends(require_permission("debts.view")),
):
    q = {}
    if direction:
        q["direction"] = direction
    if customer_id:
        q["customer_id"] = customer_id
    if supplier_id:
        q["supplier_id"] = supplier_id
    items = await db.debt_payments.find(q, {"_id": 0}).sort("created_at", -1).limit(500).to_list(None)
    return items


# ===========================================================================
# Users
# ===========================================================================
@api.get("/users")
async def list_users(user: dict = Depends(require_permission("users.view"))):
    items = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(500).to_list(None)
    return items


@api.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdateIn, user: dict = Depends(require_permission("users.edit"))):
    upd = {k: v for k, v in body.model_dump().items() if v is not None and k != "password"}
    if body.password:
        upd["password_hash"] = hash_password(body.password)
    if upd:
        res = await db.users.update_one({"user_id": user_id}, {"$set": upd})
        if not res.matched_count:
            raise HTTPException(status_code=404, detail="Không tìm thấy user")
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, request_user: dict = Depends(require_permission("users.delete"))):
    if request_user["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="Không thể tự xóa chính mình")
    res = await db.users.delete_one({"user_id": user_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")
    return {"ok": True}


@api.get("/users/shippers")
async def list_shippers(user: dict = Depends(get_current_user)):
    items = await db.users.find(
        {"role": {"$in": ["shipper", "coordinator", "staff"]}, "is_active": {"$ne": False}},
        {"_id": 0, "password_hash": 0},
    ).limit(50).to_list(None)
    return items


# ===========================================================================
# Reports
# ===========================================================================
@api.get("/reports/revenue")
async def reports_revenue(
    period: str = "daily",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_permission("reports.view")),
):
    now = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    buckets = []
    if date_from and date_to:
        start_d = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        end_d = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc)
        days = min((end_d - start_d).days + 1, 90)
        for i in range(max(days, 1)):
            d = start_d + timedelta(days=i)
            buckets.append((d, d + timedelta(days=1), d.strftime("%d/%m")))
    elif period == "daily":
        for i in range(29, -1, -1):
            d = now - timedelta(days=i)
            buckets.append((d, d + timedelta(days=1), d.strftime("%d/%m")))
    elif period == "weekly":
        for i in range(11, -1, -1):
            end = now - timedelta(days=i * 7)
            start = end - timedelta(days=7)
            buckets.append((start, end, f"T{end.strftime('%U')}"))
    else:
        for i in range(11, -1, -1):
            year = now.year
            month = now.month - i
            while month <= 0:
                month += 12
                year -= 1
            start = datetime(year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
            buckets.append((start, end, f"{month:02d}/{year}"))

    result = []
    for start, end, label in buckets:
        orders = await db.orders.find(
            {"created_at": {"$gte": start, "$lt": end}, "status": {"$ne": "cancelled"}},
            {"_id": 0, "total": 1},
        ).limit(2000).to_list(None)
        result.append({"label": label, "revenue": sum(o.get("total", 0) for o in orders), "orders": len(orders)})
    return {"period": period, "data": result}


@api.get("/reports/debt")
async def reports_debt(user: dict = Depends(require_permission("reports.view"))):
    pipeline = [
        {"$match": {"payment_method": "debt", "is_paid": {"$ne": True}, "status": {"$ne": "cancelled"}}},
        {"$group": {
            "_id": "$customer_name", "phone": {"$first": "$customer_phone"},
            "debt": {"$sum": "$remaining_amount"},
            "orders": {"$sum": 1}, "last_order": {"$max": "$created_at"},
        }},
        {"$sort": {"debt": -1}},
        {"$limit": 50},
    ]
    items = []
    async for r in db.orders.aggregate(pipeline):
        items.append({
            "customer_name": r["_id"], "phone": r.get("phone"),
            "debt": r["debt"], "orders": r["orders"], "last_order": r.get("last_order"),
        })
    return {"items": items, "total": sum(i["debt"] for i in items)}


@api.get("/reports/inventory")
async def reports_inventory(user: dict = Depends(require_permission("reports.view"))):
    products = await db.products.find({"is_active": True}, {"_id": 0}).limit(1000).to_list(None)
    materials = await db.materials.find({"is_active": True}, {"_id": 0}).limit(1000).to_list(None)
    total_value = sum(p.get("stock", 0) * p.get("cost", 0) for p in products)
    mat_value = sum(m.get("stock", 0) * m.get("cost", 0) for m in materials)
    low = [p for p in products if 0 < p.get("stock", 0) <= p.get("low_stock_threshold", 0)]
    out = [p for p in products if p.get("stock", 0) == 0]
    negative = [p for p in products if p.get("stock", 0) < 0]
    return {
        "total_products": len(products),
        "total_stock_value": total_value,
        "low_stock_count": len(low),
        "out_of_stock_count": len(out),
        "negative_stock_count": len(negative),
        "negative_stock_products": negative,
        "products": products,
        "materials": materials,
        "total_materials_value": mat_value,
    }


# ===========================================================================
# AI Chat (Claude + OpenAI)
# ===========================================================================
async def get_business_context() -> str:
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    orders_today = await db.orders.count_documents({"created_at": {"$gte": today}})
    pending = await db.orders.count_documents({"status": {"$in": ["new", "processing"]}})
    delivering = await db.orders.count_documents({"status": "delivering"})
    low_stock = await db.products.find(
        {"$expr": {"$lte": ["$stock", "$low_stock_threshold"]}, "is_active": True}, {"_id": 0},
    ).limit(20).to_list(None)
    total_customers = await db.customers.count_documents({})
    total_products = await db.products.count_documents({"is_active": True})
    today_orders_docs = await db.orders.find(
        {"created_at": {"$gte": today}}, {"_id": 0, "total": 1, "status": 1},
    ).limit(2000).to_list(None)
    today_revenue = sum(o.get("total", 0) for o in today_orders_docs if o.get("status") != "cancelled")

    low_stock_text = "\n".join(
        [f"  - {p['name']}: còn {p['stock']} {p.get('unit', 'cái')}" for p in low_stock[:10]]
    ) or "  (không có)"

    return f"""DỮ LIỆU NỘI BỘ TIỆM BÁNH BAO (thời gian thực):
- Doanh thu hôm nay: {today_revenue:,.0f} VND
- Đơn hôm nay: {orders_today}
- Đơn đang xử lý: {pending}
- Đơn đang giao: {delivering}
- Tổng sản phẩm: {total_products}
- Tổng khách hàng: {total_customers}
- Sản phẩm sắp hết hàng:
{low_stock_text}
"""


MODEL_MAP = {
    "claude": ("anthropic", "claude-sonnet-4-5-20250929"),
    "claude-4-5": ("anthropic", "claude-sonnet-4-5-20250929"),
    "claude-4-6": ("anthropic", "claude-sonnet-4-6"),
    "openai": ("openai", "gpt-5.2"),
    "openai-5.2": ("openai", "gpt-5.2"),
    "gpt-5.2": ("openai", "gpt-5.2"),
    "gpt-5.1": ("openai", "gpt-5.1"),
    "gpt-4o": ("openai", "gpt-4o"),
}


@api.post("/chat")
async def chat(body: ChatIn, user: dict = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key chưa được cấu hình")

    requested = (body.model or "claude").lower()
    provider, model_id = MODEL_MAP.get(requested, MODEL_MAP["claude"])

    context = await get_business_context()
    system_message = f"""Bạn là Bao - trợ lý AI nội bộ cho tiệm bánh bao Việt Nam. Trả lời ngắn gọn, súc tích, thân thiện.
Sử dụng dữ liệu thực tế bên dưới khi cần. Trả lời tiếng Việt mặc định.

{context}

Lưu ý: Trả lời ngắn (2-5 câu). Nếu cần dữ liệu chi tiết, đề nghị user kiểm tra trong module tương ứng."""

    chat_obj = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"{body.session_id}::{requested}",
        system_message=system_message,
    ).with_model(provider, model_id)

    history = await db.chat_messages.find(
        {"user_id": user["user_id"], "session_id": body.session_id, "model_key": requested},
        {"_id": 0},
    ).sort("created_at", 1).limit(20).to_list(None)

    try:
        for msg in history:
            if msg.get("role") == "user":
                await chat_obj.send_message(UserMessage(text=msg["content"]))
        response = await chat_obj.send_message(UserMessage(text=body.message))
    except Exception as e:
        logger.exception("Chat error")
        raise HTTPException(status_code=500, detail=f"Lỗi AI: {str(e)[:200]}")

    now = datetime.now(timezone.utc)
    await db.chat_messages.insert_many([
        {"user_id": user["user_id"], "session_id": body.session_id, "model_key": requested,
         "role": "user", "content": body.message, "created_at": now},
        {"user_id": user["user_id"], "session_id": body.session_id, "model_key": requested,
         "role": "assistant", "content": response, "created_at": now},
    ])

    return {"reply": response, "session_id": body.session_id, "model": f"{provider}/{model_id}"}


@api.get("/chat/history")
async def chat_history(session_id: str = Query(...), model: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["user_id"], "session_id": session_id}
    if model:
        q["model_key"] = model.lower()
    msgs = await db.chat_messages.find(q, {"_id": 0}).sort("created_at", 1).limit(100).to_list(None)
    return msgs


# ===========================================================================
# Seed
# ===========================================================================
async def seed_data():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.products.create_index("product_id", unique=True)
    await db.materials.create_index("material_id", unique=True)
    await db.customers.create_index("customer_id", unique=True)
    await db.customers.create_index([("name", 1), ("phone", 1)])
    await db.suppliers.create_index("supplier_id", unique=True)
    await db.orders.create_index("order_id", unique=True)
    await db.orders.create_index("created_at")
    await db.orders.create_index("customer_id")
    await db.orders.create_index("payment_method")
    await db.stock_movements.create_index("created_at")
    await db.debt_payments.create_index("created_at")
    await db.user_sessions.create_index("session_token")
    await db.login_attempts.create_index("identifier")

    now = datetime.now(timezone.utc)
    # Migrate legacy cod -> debt
    await db.orders.update_many({"payment_method": "cod"}, {"$set": {"payment_method": "debt"}})

    # Migrate legacy order statuses to new vocab (preparing -> processing)
    await db.orders.update_many({"status": "preparing"}, {"$set": {"status": "processing"}})

    # Backfill remaining_amount
    legacy_debt = await db.orders.find({"payment_method": "debt", "remaining_amount": {"$exists": False}}, {"order_id": 1, "total": 1, "is_paid": 1}).to_list(None)
    for o in legacy_debt:
        await db.orders.update_one(
            {"order_id": o["order_id"]},
            {"$set": {"remaining_amount": 0 if o.get("is_paid") else o.get("total", 0), "paid_amount": o.get("total", 0) if o.get("is_paid") else 0}},
        )

    # Seed admin
    admin = await db.users.find_one({"email": ADMIN_EMAIL})
    if not admin:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": ADMIN_EMAIL, "name": "Chủ tiệm", "role": "admin",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "auth_provider": "local", "is_active": True,
            "created_at": now,
        })
        logger.info(f"Seeded admin {ADMIN_EMAIL}")
    else:
        if not verify_password(ADMIN_PASSWORD, admin.get("password_hash", "")):
            await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})

    # Seed default settings if missing
    s = await db.settings.find_one({"_singleton": SETTINGS_ID})
    if not s:
        defaults = ShopSettingsIn().model_dump()
        defaults["_singleton"] = SETTINGS_ID
        defaults["updated_at"] = now
        await db.settings.insert_one(defaults)

    # No more demo seeding — user wants real data only.


@app.on_event("startup")
async def on_startup():
    await seed_data()
    logger.info("Banh Bao Admin API v2 ready")


@app.on_event("shutdown")
async def on_shutdown():
    mongo_client.close()


@api.get("/")
async def root():
    return {"service": "Bánh Bao Admin API", "status": "ok", "version": "2.0"}


app.include_router(api)
