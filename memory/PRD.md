# Bánh Bao Admin — Product Requirements Document (PRD)

## Original Problem Statement
Internal management dashboard for a Vietnamese steamed bun (bánh bao) shop. Now a comprehensive multi-module system covering Sales, Inventory + Raw Materials, Customers + CRM, Debts (Customer + Supplier), Delivery management, Staff with granular RBAC, Reports, AI Assistant. Multi-language Vi/En.

## Tech Stack
- Backend: FastAPI + Motor (MongoDB) + bcrypt + PyJWT + emergentintegrations (Claude Sonnet 4.5 + OpenAI GPT-5.2/5.1/4o) + pandas + openpyxl
- Frontend: React 18 + React Router + TailwindCSS + Recharts + Lucide + qrcode.react + html2pdf.js + xlsx
- Auth: JWT (cookies) + Emergent Google OAuth
- AI: Both Claude + OpenAI via Universal Emergent LLM Key, user-selectable

## Roles & RBAC (7 roles)
- **admin** — full access
- **manager** — all except user mgmt + settings edit
- **coordinator** — orders + customer ops + delivery + debts view + reports
- **warehouse** — products + materials + stock ops + suppliers + reports
- **accountant** — orders view/print + debts (collect/pay/remind) + reports + export
- **shipper** — orders.view + delivery.view + delivery.bill (no customers list)
- **staff** — basic order/customer ops

Each user can override role defaults with granular custom permissions (checkbox matrix).

## Modules Implemented (v2.0)

### Phase 0 — Quick wins
- COD → Công nợ rename (with backwards-compat migration)
- Server time endpoint + live clock display
- Sort ascending/descending toggle on lists
- Order Duplicate (Copy / Mua lại) → creates new order with today's date
- Reset demo data button (admin only)

### Phase 1 — Settings & Bills
- Shop settings: name, address, phone, email, website, tax_id
- Bank info: bank name, account, holder → **VietQR auto-generated on bill**
- Logo upload (base64, max 300KB)
- 7 toggle checkboxes for fields on bill (logo/address/phone/email/website/tax_id/bank_qr)
- Bill footer custom text
- 3 print formats: **80mm thermal**, **A4 portrait**, **A5 landscape**
- Each format renders shop info + QR + items + totals + purchase date + print date

### Phase 2 — Customers expansion
- New fields: code (auto), nickname, tax_id (MST/CCCD), district, city, type (retail/wholesale), classification (custom), assigned_user_id, **max_debt_days**, **max_debt_amount**
- Excel template download + Excel import (xlsx) + Excel export
- Sort with-orders-first via Customer Care page
- Customer Care page: list with "needs care" flagging (14+/30+/60+ days since last order), tel: links, district filter

### Phase 3 — Debts module
- Customer debts aggregated: total / due_soon (≤3d) / overdue, drill-down per customer
- Customer order detail: paid_amount, remaining_amount, days_to_due, overdue flag
- Partial payment collection (`/debts/collect`)
- Supplier debt tracking + `/debts/pay-supplier` (pay supplier)
- Payment history with direction (in/out)
- 3 tabs UI: Công nợ KH / Công nợ NCC / Lịch sử thanh toán

### Phase 4 — Raw Materials (NVL) + Stock
- Materials CRUD with expiration_days, low_stock_threshold
- Stock In endpoint with batch_code, production_date, expiration_date, supplier link, unit_price
- Stock Adjust endpoint (damage/waste/lost/correction/expired)
- Stock movements log (full history)
- Expiring soon endpoint (FIFO basis)
- Inventory report includes materials valuation

### Phase 6 — RBAC
- 7 roles + 38 granular permission keys
- Permission matrix UI in Users page (checkbox grid grouped by category)
- Sidebar items filtered by user permissions
- Backend enforced via `require_permission()` dependency

### Phase 7 — Delivery & Shippers
- Shipper assignment on order
- Delivery page groups orders by 4 shifts (Sáng/Trưa/Chiều/Tối) + by shipper
- Quick assign dropdown per order
- Date filter
- Delivery bill print (uses standard A4/80mm templates)

### Order workflow (new statuses)
- new → processing → delivering → delivered
- delivering → debt_pending (for debt orders)
- Any → cancelled (restores stock)

### Order new fields
- type: retail / wholesale / delivery
- customer_district + customer_address
- payment_method: cash / transfer / debt / ewallet / card (5 options)
- discount + discount_percent (both deduct from total)
- shipping_fee
- assigned_shipper_id + due_date (for debt orders, auto-set from customer.max_debt_days)

### AI Assistant
- Both Claude Sonnet 4.5 AND OpenAI GPT-5.2/5.1/4o
- User selects model via settings gear in chat panel
- Multi-turn memory per (session_id, model)
- Live business context injected (today revenue, pending orders, low stock)

## Test Coverage
- Backend: **38/38 tests pass (100%)**
- Frontend: All 12 pages verified manually + via screenshot
- Comprehensive test suite at `/app/backend/tests/test_v2.py`

## Implementation Dates
- 2026-05-14: v1 MVP delivered
- 2026-05-14: 13 user-requested improvements (iteration 2)
- 2026-05-18: **v2 — Phase 0+1+2+3+4+6+7 (this iteration)** — major expansion

## Known Limitations (still MOCKED / not done)
- Phase 5 (Production batches with shifts + AI forecasting) — DEFERRED per user
- Phase 8 (Combo recommendation engine + AI scoring + churn analysis) — DEFERRED per user
- Real Email/SMS notifications — NOT implemented (mock only)
- Online payment processing (VNPay/MoMo/Stripe) — NOT implemented
- Bill print delivery confirmation signature — UI only
- Route optimization (TSP solver) — basic shift grouping only

## Test Credentials
See `/app/memory/test_credentials.md`
