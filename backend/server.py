from dotenv import load_dotenv
load_dotenv()

import os
import uuid
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

import bcrypt
import jwt
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient

from emergentintegrations.llm.chat import LlmChat, UserMessage

# ----- Setup -----
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("banhbao")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@banhbao.vn")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

app = FastAPI(title="Bánh Bao Admin API")
api = APIRouter(prefix="/api")

# CORS - allow credentials with explicit origins from env (comma separated)
cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
if cors_origins_env.strip() == "*":
    cors_origins = ["*"]
    allow_credentials = False  # cannot combine credentials + wildcard
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


# ----- Helpers -----
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
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
    resp.set_cookie(
        key="access_token", value=access, httponly=True, secure=True,
        samesite="none", max_age=12 * 3600, path="/",
    )
    resp.set_cookie(
        key="refresh_token", value=refresh, httponly=True, secure=True,
        samesite="none", max_age=7 * 24 * 3600, path="/",
    )


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
    # Try JWT (access_token cookie / Bearer)
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

    # Try Emergent session_token (cookie or X-Session-Token header)
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


def require_role(*roles: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep


# ----- Models -----
class UserPublic(BaseModel):
    user_id: str
    email: str
    name: str
    role: Literal["admin", "manager", "staff"] = "staff"
    picture: Optional[str] = None
    phone: Optional[str] = None
    payment_method: Optional[str] = None
    created_at: datetime
    auth_provider: str = "local"


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)
    role: Literal["admin", "manager", "staff"] = "staff"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["admin", "manager", "staff"]] = None
    phone: Optional[str] = None
    payment_method: Optional[str] = None
    password: Optional[str] = None


class ProductIn(BaseModel):
    name: str
    sku: Optional[str] = None
    category: str = "Bánh bao"
    description: Optional[str] = ""
    price: float
    cost: float = 0
    stock: int = 0
    low_stock_threshold: int = 10
    unit: str = "cái"
    image_url: Optional[str] = None
    variants: List[dict] = []
    is_active: bool = True


class CustomerIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    group: Literal["vip", "regular", "new"] = "new"
    notes: Optional[str] = ""


class SupplierIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
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
    items: List[OrderItemIn]
    payment_method: Literal["cash", "transfer", "cod", "card"] = "cash"
    note: Optional[str] = ""
    discount: float = 0
    shipping_fee: float = 0


class OrderStatusUpdate(BaseModel):
    status: Literal["preparing", "delivering", "delivered", "cancelled"]
    note: Optional[str] = ""


class ChatIn(BaseModel):
    session_id: str
    message: str


# ----- Auth Endpoints -----
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email đã tồn tại")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": email,
        "name": body.name,
        "role": body.role,
        "password_hash": hash_password(body.password),
        "auth_provider": "local",
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

    # Brute force check
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until and locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Quá nhiều lần thử. Hãy thử lại sau 15 phút.")

    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": datetime.now(timezone.utc) + timedelta(minutes=15)}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")

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
        response.set_cookie(
            "access_token", new_access, httponly=True, secure=True,
            samesite="none", max_age=12 * 3600, path="/",
        )
        return {"ok": True}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@api.post("/auth/session")
async def emergent_session(request: Request, response: Response):
    """Exchange Emergent session_id (from URL fragment) for a server session."""
    session_id = request.headers.get("X-Session-ID") or (await request.json()).get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")

    try:
        r = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=10,
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
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": "staff",
            "auth_provider": "google",
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
            "session_token": session_token,
            "user_id": user["user_id"],
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    response.set_cookie(
        "session_token", session_token, httponly=True, secure=True,
        samesite="none", max_age=7 * 24 * 3600, path="/",
    )
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


# ----- Dashboard -----
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    today_orders = await db.orders.find(
        {"created_at": {"$gte": today_start}}, {"_id": 0}
    ).to_list(None)
    today_revenue = sum(o.get("total", 0) for o in today_orders if o.get("status") != "cancelled")

    total_products = await db.products.count_documents({"is_active": True})
    total_customers = await db.customers.count_documents({})

    debt_orders = await db.orders.find(
        {"payment_method": "cod", "status": {"$ne": "cancelled"}, "is_paid": {"$ne": True}},
        {"_id": 0},
    ).to_list(None)
    total_debt = sum(o.get("total", 0) for o in debt_orders)

    # 7-day chart
    chart = []
    for i in range(6, -1, -1):
        day = today_start - timedelta(days=i)
        day_end = day + timedelta(days=1)
        day_orders = await db.orders.find(
            {"created_at": {"$gte": day, "$lt": day_end}, "status": {"$ne": "cancelled"}}, {"_id": 0}
        ).to_list(None)
        chart.append({
            "date": day.strftime("%d/%m"),
            "revenue": sum(o.get("total", 0) for o in day_orders),
            "orders": len(day_orders),
        })

    low_stock = await db.products.find(
        {"$expr": {"$lte": ["$stock", "$low_stock_threshold"]}, "is_active": True},
        {"_id": 0},
    ).sort("stock", 1).limit(8).to_list(None)

    recent_orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(6).to_list(None)

    # Top products from delivered orders
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
            "product_id": r["_id"],
            "name": r["name"],
            "quantity": r["quantity"],
            "revenue": r["revenue"],
        })

    return {
        "today_revenue": today_revenue,
        "today_orders": len(today_orders),
        "total_debt": total_debt,
        "total_products": total_products,
        "total_customers": total_customers,
        "chart_7days": chart,
        "low_stock_products": low_stock,
        "recent_orders": recent_orders,
        "top_products": top_products,
    }


# ----- Products -----
@api.get("/products")
async def list_products(
    q: Optional[str] = None,
    category: Optional[str] = None,
    low_stock: bool = False,
    user: dict = Depends(get_current_user),
):
    query = {}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"sku": {"$regex": q, "$options": "i"}}]
    if category:
        query["category"] = category
    if low_stock:
        query["$expr"] = {"$lte": ["$stock", "$low_stock_threshold"]}
    items = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)
    return items


@api.post("/products")
async def create_product(body: ProductIn, user: dict = Depends(require_role("admin", "manager"))):
    doc = body.model_dump()
    doc["product_id"] = f"prd_{uuid.uuid4().hex[:10]}"
    doc["sku"] = doc.get("sku") or doc["product_id"].upper()
    doc["created_at"] = datetime.now(timezone.utc)
    doc["updated_at"] = doc["created_at"]
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductIn, user: dict = Depends(require_role("admin", "manager"))):
    upd = body.model_dump()
    upd["updated_at"] = datetime.now(timezone.utc)
    res = await db.products.update_one({"product_id": product_id}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
    doc = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    return doc


@api.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(require_role("admin"))):
    res = await db.products.delete_one({"product_id": product_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm")
    return {"ok": True}


# ----- Customers -----
@api.get("/customers")
async def list_customers(q: Optional[str] = None, group: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    if group:
        query["group"] = group
    items = await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)
    return items


@api.post("/customers")
async def create_customer(body: CustomerIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["customer_id"] = f"cus_{uuid.uuid4().hex[:10]}"
    doc["created_at"] = datetime.now(timezone.utc)
    doc["total_orders"] = 0
    doc["total_spent"] = 0.0
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/customers/{customer_id}")
async def update_customer(customer_id: str, body: CustomerIn, user: dict = Depends(get_current_user)):
    upd = body.model_dump()
    res = await db.customers.update_one({"customer_id": customer_id}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")
    return await db.customers.find_one({"customer_id": customer_id}, {"_id": 0})


@api.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, user: dict = Depends(require_role("admin", "manager"))):
    res = await db.customers.delete_one({"customer_id": customer_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy")
    return {"ok": True}


# ----- Suppliers -----
@api.get("/suppliers")
async def list_suppliers(q: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    items = await db.suppliers.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)
    return items


@api.post("/suppliers")
async def create_supplier(body: SupplierIn, user: dict = Depends(require_role("admin", "manager"))):
    doc = body.model_dump()
    doc["supplier_id"] = f"sup_{uuid.uuid4().hex[:10]}"
    doc["created_at"] = datetime.now(timezone.utc)
    await db.suppliers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, body: SupplierIn, user: dict = Depends(require_role("admin", "manager"))):
    upd = body.model_dump()
    res = await db.suppliers.update_one({"supplier_id": supplier_id}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy NCC")
    return await db.suppliers.find_one({"supplier_id": supplier_id}, {"_id": 0})


@api.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, user: dict = Depends(require_role("admin"))):
    res = await db.suppliers.delete_one({"supplier_id": supplier_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy NCC")
    return {"ok": True}


# ----- Orders -----
def _generate_order_code() -> str:
    return f"BB{datetime.now(timezone.utc).strftime('%y%m%d')}{uuid.uuid4().hex[:4].upper()}"


@api.get("/orders")
async def list_orders(
    q: Optional[str] = None,
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(get_current_user),
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
        query["payment_method"] = payment_method
    date_q = {}
    if date_from:
        date_q["$gte"] = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
    if date_to:
        date_q["$lte"] = datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc) + timedelta(days=1)
    if date_q:
        query["created_at"] = date_q

    items = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).limit(200).to_list(None)
    return items


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    return o


@api.post("/orders")
async def create_order(body: OrderIn, user: dict = Depends(get_current_user)):
    items = [it.model_dump() for it in body.items]
    subtotal = sum(it["subtotal"] for it in items)
    total = subtotal - body.discount + body.shipping_fee

    order_id = f"ord_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    doc = {
        "order_id": order_id,
        "order_code": _generate_order_code(),
        "customer_id": body.customer_id,
        "customer_name": body.customer_name,
        "customer_phone": body.customer_phone,
        "items": items,
        "subtotal": subtotal,
        "discount": body.discount,
        "shipping_fee": body.shipping_fee,
        "total": total,
        "payment_method": body.payment_method,
        "is_paid": body.payment_method in ("cash", "transfer", "card"),
        "status": "preparing",
        "note": body.note,
        "timeline": [{
            "status": "preparing",
            "at": now,
            "by": user.get("name", "system"),
            "note": "Tạo đơn hàng mới",
        }],
        "created_at": now,
        "created_by": user["user_id"],
        "updated_at": now,
    }
    await db.orders.insert_one(doc)

    # decrement stock + update customer stats
    for it in items:
        await db.products.update_one(
            {"product_id": it["product_id"]},
            {"$inc": {"stock": -it["quantity"]}},
        )
    if body.customer_id:
        await db.customers.update_one(
            {"customer_id": body.customer_id},
            {"$inc": {"total_orders": 1, "total_spent": total}},
        )

    doc.pop("_id", None)
    return doc


@api.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusUpdate, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"order_id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")
    now = datetime.now(timezone.utc)
    entry = {"status": body.status, "at": now, "by": user.get("name", "system"), "note": body.note or ""}
    update = {"$set": {"status": body.status, "updated_at": now}, "$push": {"timeline": entry}}
    if body.status == "delivered":
        update["$set"]["is_paid"] = True
    if body.status == "cancelled":
        # restore stock
        for it in o.get("items", []):
            await db.products.update_one(
                {"product_id": it["product_id"]},
                {"$inc": {"stock": it["quantity"]}},
            )
    await db.orders.update_one({"order_id": order_id}, update)
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})


@api.delete("/orders/{order_id}")
async def delete_order(order_id: str, user: dict = Depends(require_role("admin"))):
    o = await db.orders.find_one({"order_id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Không tìm thấy")
    if o.get("status") != "cancelled":
        for it in o.get("items", []):
            await db.products.update_one(
                {"product_id": it["product_id"]},
                {"$inc": {"stock": it["quantity"]}},
            )
    await db.orders.delete_one({"order_id": order_id})
    return {"ok": True}


# ----- Users (Admin only) -----
@api.get("/users")
async def list_users(user: dict = Depends(require_role("admin", "manager"))):
    items = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(None)
    return items


@api.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdateIn, user: dict = Depends(require_role("admin"))):
    upd = {k: v for k, v in body.model_dump().items() if v is not None and k != "password"}
    if body.password:
        upd["password_hash"] = hash_password(body.password)
    if upd:
        res = await db.users.update_one({"user_id": user_id}, {"$set": upd})
        if not res.matched_count:
            raise HTTPException(status_code=404, detail="Không tìm thấy user")
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, request_user: dict = Depends(require_role("admin"))):
    if request_user["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="Không thể tự xóa chính mình")
    res = await db.users.delete_one({"user_id": user_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")
    return {"ok": True}


# ----- Reports -----
@api.get("/reports/revenue")
async def reports_revenue(period: str = "daily", user: dict = Depends(get_current_user)):
    """period: daily (last 30d), weekly (last 12w), monthly (last 12m)"""
    now = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    buckets = []
    if period == "daily":
        for i in range(29, -1, -1):
            d = now - timedelta(days=i)
            buckets.append((d, d + timedelta(days=1), d.strftime("%d/%m")))
    elif period == "weekly":
        for i in range(11, -1, -1):
            end = now - timedelta(days=i * 7)
            start = end - timedelta(days=7)
            buckets.append((start, end, f"T{end.strftime('%U')}"))
    else:  # monthly
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
            {"created_at": {"$gte": start, "$lt": end}, "status": {"$ne": "cancelled"}}, {"_id": 0}
        ).to_list(None)
        result.append({
            "label": label,
            "revenue": sum(o.get("total", 0) for o in orders),
            "orders": len(orders),
        })
    return {"period": period, "data": result}


@api.get("/reports/debt")
async def reports_debt(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"payment_method": "cod", "is_paid": {"$ne": True}, "status": {"$ne": "cancelled"}}},
        {"$group": {
            "_id": "$customer_name",
            "phone": {"$first": "$customer_phone"},
            "debt": {"$sum": "$total"},
            "orders": {"$sum": 1},
            "last_order": {"$max": "$created_at"},
        }},
        {"$sort": {"debt": -1}},
        {"$limit": 50},
    ]
    items = []
    async for r in db.orders.aggregate(pipeline):
        items.append({
            "customer_name": r["_id"],
            "phone": r.get("phone"),
            "debt": r["debt"],
            "orders": r["orders"],
            "last_order": r.get("last_order"),
        })
    return {"items": items, "total": sum(i["debt"] for i in items)}


@api.get("/reports/inventory")
async def reports_inventory(user: dict = Depends(get_current_user)):
    products = await db.products.find({"is_active": True}, {"_id": 0}).to_list(None)
    total_value = sum(p.get("stock", 0) * p.get("cost", 0) for p in products)
    low = [p for p in products if p.get("stock", 0) <= p.get("low_stock_threshold", 0)]
    out_of_stock = [p for p in products if p.get("stock", 0) == 0]
    return {
        "total_products": len(products),
        "total_stock_value": total_value,
        "low_stock_count": len(low),
        "out_of_stock_count": len(out_of_stock),
        "products": products,
    }


# ----- AI Chatbot -----
async def get_business_context() -> str:
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    orders_today = await db.orders.count_documents({"created_at": {"$gte": today}})
    pending = await db.orders.count_documents({"status": "preparing"})
    delivering = await db.orders.count_documents({"status": "delivering"})
    low_stock = await db.products.find(
        {"$expr": {"$lte": ["$stock", "$low_stock_threshold"]}, "is_active": True}, {"_id": 0}
    ).to_list(None)
    total_customers = await db.customers.count_documents({})
    total_products = await db.products.count_documents({"is_active": True})
    today_orders_docs = await db.orders.find({"created_at": {"$gte": today}}, {"_id": 0}).to_list(None)
    today_revenue = sum(o.get("total", 0) for o in today_orders_docs if o.get("status") != "cancelled")

    low_stock_text = "\n".join(
        [f"  - {p['name']}: còn {p['stock']} {p.get('unit', 'cái')} (ngưỡng: {p['low_stock_threshold']})" for p in low_stock[:10]]
    ) or "  (không có)"

    return f"""DỮ LIỆU NỘI BỘ TIỆM BÁNH BAO (cập nhật thời gian thực):
- Doanh thu hôm nay: {today_revenue:,.0f} VND
- Đơn hôm nay: {orders_today}
- Đơn đang chuẩn bị: {pending}
- Đơn đang giao: {delivering}
- Tổng sản phẩm đang bán: {total_products}
- Tổng khách hàng: {total_customers}
- Sản phẩm sắp hết hàng:
{low_stock_text}
"""


@api.post("/chat")
async def chat(body: ChatIn, user: dict = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key chưa được cấu hình")

    context = await get_business_context()
    system_message = f"""Bạn là Bao - trợ lý AI nội bộ cho tiệm bánh bao Việt Nam. Giúp nhân viên/admin trả lời nhanh các câu hỏi về kinh doanh:
- Đơn hàng, doanh thu, tồn kho, khách hàng
- Đưa lời khuyên thực tế, súc tích, thân thiện
- Trả lời bằng tiếng Việt theo mặc định; nếu user dùng tiếng Anh thì trả lời tiếng Anh
- Sử dụng dữ liệu thực tế bên dưới khi cần

{context}

Lưu ý: Trả lời ngắn gọn (2-5 câu), không lan man. Nếu không chắc, đề nghị user kiểm tra trong module tương ứng."""

    chat_obj = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=body.session_id,
        system_message=system_message,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    # Load previous messages from DB to maintain context across requests
    history = await db.chat_messages.find(
        {"user_id": user["user_id"], "session_id": body.session_id},
        {"_id": 0},
    ).sort("created_at", 1).limit(20).to_list(None)

    try:
        # Replay history into the session for context
        for msg in history:
            if msg.get("role") == "user":
                await chat_obj.send_message(UserMessage(text=msg["content"]))

        response = await chat_obj.send_message(UserMessage(text=body.message))
    except Exception as e:
        logger.exception("Chat error")
        raise HTTPException(status_code=500, detail=f"Lỗi AI: {str(e)[:200]}")

    now = datetime.now(timezone.utc)
    await db.chat_messages.insert_many([
        {
            "user_id": user["user_id"],
            "session_id": body.session_id,
            "role": "user",
            "content": body.message,
            "created_at": now,
        },
        {
            "user_id": user["user_id"],
            "session_id": body.session_id,
            "role": "assistant",
            "content": response,
            "created_at": now,
        },
    ])

    return {"reply": response, "session_id": body.session_id}


@api.get("/chat/history")
async def chat_history(session_id: str = Query(...), user: dict = Depends(get_current_user)):
    msgs = await db.chat_messages.find(
        {"user_id": user["user_id"], "session_id": session_id},
        {"_id": 0},
    ).sort("created_at", 1).to_list(None)
    return msgs


# ----- Seed & Startup -----
async def seed_data():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.products.create_index("product_id", unique=True)
    await db.customers.create_index("customer_id", unique=True)
    await db.suppliers.create_index("supplier_id", unique=True)
    await db.orders.create_index("order_id", unique=True)
    await db.orders.create_index("created_at")
    await db.user_sessions.create_index("session_token")
    await db.login_attempts.create_index("identifier")

    # Admin
    admin = await db.users.find_one({"email": ADMIN_EMAIL})
    now = datetime.now(timezone.utc)
    if not admin:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": ADMIN_EMAIL,
            "name": "Chủ tiệm",
            "role": "admin",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "auth_provider": "local",
            "created_at": now,
        })
        logger.info(f"Seeded admin {ADMIN_EMAIL}")
    else:
        # ensure password is current
        if not verify_password(ADMIN_PASSWORD, admin.get("password_hash", "")):
            await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})

    # Demo staff
    staff_email = "staff@banhbao.vn"
    if not await db.users.find_one({"email": staff_email}):
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": staff_email,
            "name": "Nhân viên A",
            "role": "staff",
            "password_hash": hash_password("staff123"),
            "auth_provider": "local",
            "created_at": now,
        })

    # Sample products
    if await db.products.count_documents({}) == 0:
        sample_products = [
            {"name": "Bánh bao nhân thịt", "category": "Bánh bao mặn", "price": 15000, "cost": 8000, "stock": 80, "low_stock_threshold": 20, "unit": "cái",
             "image_url": "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400", "description": "Bánh bao truyền thống nhân thịt heo, trứng cút"},
            {"name": "Bánh bao xá xíu", "category": "Bánh bao mặn", "price": 18000, "cost": 9500, "stock": 45, "low_stock_threshold": 20, "unit": "cái",
             "image_url": "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400", "description": "Nhân xá xíu kiểu Hong Kong"},
            {"name": "Bánh bao chay", "category": "Bánh bao chay", "price": 12000, "cost": 6000, "stock": 12, "low_stock_threshold": 15, "unit": "cái",
             "image_url": "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400", "description": "Nhân nấm, đậu hũ, rau củ"},
            {"name": "Bánh bao kim sa", "category": "Bánh bao ngọt", "price": 20000, "cost": 11000, "stock": 30, "low_stock_threshold": 20, "unit": "cái",
             "image_url": "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400", "description": "Nhân trứng muối chảy"},
            {"name": "Bánh bao chiên", "category": "Bánh bao mặn", "price": 16000, "cost": 8500, "stock": 5, "low_stock_threshold": 15, "unit": "cái",
             "image_url": "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400", "description": "Bánh bao chiên giòn"},
            {"name": "Bánh bao trà sữa", "category": "Bánh bao ngọt", "price": 22000, "cost": 12000, "stock": 25, "low_stock_threshold": 20, "unit": "cái",
             "image_url": "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400", "description": "Phiên bản mới lạ, vị trà sữa trân châu"},
        ]
        for p in sample_products:
            p["product_id"] = f"prd_{uuid.uuid4().hex[:10]}"
            p["sku"] = p["product_id"].upper()
            p["is_active"] = True
            p["variants"] = []
            p["created_at"] = now
            p["updated_at"] = now
        await db.products.insert_many(sample_products)

    # Sample customers
    if await db.customers.count_documents({}) == 0:
        sample_customers = [
            {"name": "Chị Lan", "phone": "0901234567", "email": "lan@gmail.com", "address": "12 Lý Tự Trọng, Q1, TPHCM", "group": "vip", "notes": "Khách quen, đặt thường xuyên"},
            {"name": "Anh Hùng", "phone": "0912345678", "email": "hung@gmail.com", "address": "45 Hai Bà Trưng, Q1, TPHCM", "group": "regular", "notes": ""},
            {"name": "Chị Mai", "phone": "0923456789", "email": "mai@gmail.com", "address": "78 Nguyễn Trãi, Q5, TPHCM", "group": "vip", "notes": ""},
            {"name": "Anh Tuấn", "phone": "0934567890", "email": "", "address": "100 Lê Văn Sỹ, Q3, TPHCM", "group": "new", "notes": ""},
            {"name": "Cô Hằng", "phone": "0945678901", "email": "hang@gmail.com", "address": "55 Bùi Viện, Q1, TPHCM", "group": "regular", "notes": ""},
        ]
        for c in sample_customers:
            c["customer_id"] = f"cus_{uuid.uuid4().hex[:10]}"
            c["created_at"] = now
            c["total_orders"] = 0
            c["total_spent"] = 0.0
        await db.customers.insert_many(sample_customers)

    # Sample suppliers
    if await db.suppliers.count_documents({}) == 0:
        sample_suppliers = [
            {"name": "Xưởng bột mì Phương Nam", "phone": "0281234567", "email": "phuongnam@supply.vn", "address": "KCN Tân Bình, TPHCM", "rating": 5, "notes": "Bột mì cao cấp"},
            {"name": "Thịt sạch Vissan", "phone": "0282345678", "email": "vissan@supply.vn", "address": "420 Nơ Trang Long, BT", "rating": 5, "notes": "Đối tác lâu năm"},
            {"name": "Trứng cút Long An", "phone": "0723456789", "email": "longan@supply.vn", "address": "Long An", "rating": 4, "notes": ""},
        ]
        for s in sample_suppliers:
            s["supplier_id"] = f"sup_{uuid.uuid4().hex[:10]}"
            s["created_at"] = now
        await db.suppliers.insert_many(sample_suppliers)

    # Sample orders (last 7 days)
    if await db.orders.count_documents({}) == 0:
        products = await db.products.find({}, {"_id": 0}).to_list(None)
        customers = await db.customers.find({}, {"_id": 0}).to_list(None)
        if products and customers:
            import random
            for day_offset in range(6, -1, -1):
                day = now - timedelta(days=day_offset)
                # 2-6 orders per day
                for _ in range(random.randint(2, 6)):
                    cust = random.choice(customers)
                    n_items = random.randint(1, 3)
                    items = []
                    chosen = random.sample(products, min(n_items, len(products)))
                    for p in chosen:
                        qty = random.randint(2, 8)
                        items.append({
                            "product_id": p["product_id"],
                            "name": p["name"],
                            "price": p["price"],
                            "quantity": qty,
                            "subtotal": p["price"] * qty,
                        })
                    subtotal = sum(it["subtotal"] for it in items)
                    discount = 0
                    shipping = random.choice([0, 15000, 20000])
                    total = subtotal - discount + shipping
                    payment = random.choice(["cash", "transfer", "cod"])
                    status = "delivered" if day_offset > 0 else random.choice(["preparing", "delivering", "delivered"])
                    created = day + timedelta(hours=random.randint(7, 20), minutes=random.randint(0, 59))
                    timeline = [{"status": "preparing", "at": created, "by": "Chủ tiệm", "note": "Tạo đơn"}]
                    if status in ("delivering", "delivered"):
                        timeline.append({"status": "delivering", "at": created + timedelta(minutes=30), "by": "Chủ tiệm", "note": "Bắt đầu giao"})
                    if status == "delivered":
                        timeline.append({"status": "delivered", "at": created + timedelta(hours=1), "by": "Chủ tiệm", "note": "Đã giao thành công"})
                    order_doc = {
                        "order_id": f"ord_{uuid.uuid4().hex[:12]}",
                        "order_code": f"BB{created.strftime('%y%m%d')}{uuid.uuid4().hex[:4].upper()}",
                        "customer_id": cust["customer_id"],
                        "customer_name": cust["name"],
                        "customer_phone": cust["phone"],
                        "items": items,
                        "subtotal": subtotal,
                        "discount": discount,
                        "shipping_fee": shipping,
                        "total": total,
                        "payment_method": payment,
                        "is_paid": status == "delivered" or payment in ("cash", "transfer"),
                        "status": status,
                        "note": "",
                        "timeline": timeline,
                        "created_at": created,
                        "created_by": "system",
                        "updated_at": created,
                    }
                    await db.orders.insert_one(order_doc)


@app.on_event("startup")
async def on_startup():
    await seed_data()
    logger.info("Banh Bao Admin API ready")


@app.on_event("shutdown")
async def on_shutdown():
    mongo_client.close()


@api.get("/")
async def root():
    return {"service": "Bánh Bao Admin API", "status": "ok"}


app.include_router(api)
