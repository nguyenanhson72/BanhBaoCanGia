# Bánh Bao Admin — Product Requirements Document (PRD)

## Original Problem Statement
Internal management dashboard for a Vietnamese steamed bun (bánh bao) shop. Comprehensive multi-module system covering Sales, Inventory + Raw Materials, **Production with shifts + AI forecast**, Customers + **AI scoring/combo insights**, Debts (Customer + Supplier), Delivery management, Staff with granular RBAC, Reports, AI Assistant. Multi-language Vi/En.

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

## Modules Implemented (v2.1)

### Phase 0 — Quick wins
- COD → Công nợ rename, server time + live clock, sort toggle, order duplicate, reset demo

### Phase 1 — Settings & Bills
- Shop settings: name/address/phone/email/website/tax_id + bank info (VietQR auto-generated)
- Logo upload base64 (≤500KB), 7 bill-field toggles, footer text
- 3 print formats: **80mm thermal**, **A4 portrait**, **A5 landscape (compact)**

### Phase 2 — Customers
- New fields: code/nickname/tax_id/district/city/type/classification/assigned_user_id/max_debt_days/max_debt_amount
- Excel template/import/export
- Customer Care page: needs-care flag, daily + monthly stats, tel: links, district filter

### Phase 3 — Debts
- Customer debts aggregated (total / due_soon ≤3d / overdue) + drill-down
- Partial collection, supplier debts + auto-create supplier debt when stock-in with unit_price>0
- Payment history with direction (in/out)

### Phase 4 — Raw Materials + Stock
- Materials CRUD + Stock In (batch_code, prod_date, exp_date, supplier, unit_price)
- Stock Adjust (damage/waste/lost/correction/expired), movements log, expiring-soon FIFO

### Phase 5 — Production (NEW v2.1)
- Production batches CRUD with shift (morning/afternoon/evening/night)
- POST increments product stock; DELETE rolls back
- `GET /api/production/forecast?days_ahead=N` — AI-driven 28-day DOW lookback to recommend tomorrow's production qty per product with +10% buffer; sorted by needs_to_produce desc

### Phase 6 — RBAC
- 7 roles + 38 granular permission keys + matrix UI

### Phase 7 — Delivery
- Shipper assignment, grouped by 4 shifts (Sáng/Trưa/Chiều/Tối), date filter, delivery-bill print

### Phase 8 — AI Insights (NEW v2.1)
- `GET /api/insights/combos` — co-occurrence pairs of products (frequently bought together) with count + revenue
- `GET /api/insights/customer-scoring` — 5 buckets (VIP/high_potential/at_risk/churned/new) using order count, spend, recency
- `GET /api/insights/ai-suggest` — LLM-generated 3-5 prioritized actions for this week

### Order workflow
- new → processing → delivering → delivered, delivering→debt_pending for debt orders, Any→cancelled (restores stock)
- Fields: type (retail/wholesale/delivery), customer_district + address, payment_method (cash/transfer/debt/ewallet/card), discount + discount_percent, shipping_fee, assigned_shipper_id, due_date

### Dashboard
- KPI cards (Doanh thu hôm nay, Đơn hôm nay, Công nợ, Sản phẩm) all click-through to corresponding tab
- 7-day revenue chart, top sellers, recent orders, low-stock alerts

### AI Assistant
- Claude Sonnet 4.5 + OpenAI GPT-5.2/5.1/4o, user-selectable, multi-turn memory, live business context injection

## Test Coverage
- Backend: **50/50 tests pass (100%)** — `tests/test_v2.py` (38) + `tests/test_phase_5_8.py` (12)
- Frontend: 14 pages verified (Dashboard, Orders, NewOrder, OrderDetail, Products, Materials, Production, Customers, CustomerCare, Insights, Suppliers, Debts, Delivery, Users, Reports, Settings)

## Implementation Timeline
- 2026-05-14: v1 MVP delivered
- 2026-05-14: 13 user-requested improvements (iteration 2)
- 2026-05-18: v2 — Phase 0+1+2+3+4+6+7
- 2026-05-18: v2.1 — Phase 5 (Production + AI forecast) + Phase 8 (AI Insights/Combos/Scoring) + A5 compact print + Dashboard click-throughs + supplier-auto-debt on stock-in + monthly stats in CustomerCare + bug fixes (Products.jsx stock-in handlers + customer-care tz-naive crash)
- 2026-05-19: **v2.2 Đợt 1 — UX & address reform** — order clone-via-form (prefill NewOrder, editable before save), stock-in no longer creates payment-history entry (only supplier_debt increment), district label "Quận/Huyện" → "Phường/Xã", added city field "Tỉnh/Thành phố" everywhere (NewOrder + Customer Care + Customers list), removed "Loại" filter from customers list, Customer Care now has city filter + sort by city/name/spent, sidebar "Sản xuất" → "Kho hàng hóa"
- 2026-05-19: **v2.2 Đợt 2 — Permission & Security** — PIN2 (mật khẩu cấp 2) admin-set in Settings; required by PUT /orders/status + DELETE /orders/{id}. X-PIN2 header injected by axios interceptor (5-min cache). 2 delete-pins + account-password (3-layer) for POST /orders/delete-all wipes ALL orders + restores stock. Dashboard widgets gated by reports/orders/debts/products permissions. Products edit/delete buttons hidden without products.edit/delete perm. 11 new pytest tests (test_phase_2_security.py)
- 2026-05-19: **v2.2 Đợt 3 — Data & Export & Warehouse** — bill customization (accent color picker, logo position L/C/R, 4 signature blocks: KH/NV giao/QL Kho/Kế toán, 5 ghi chú cố định). New endpoints: GET /system/export-all-excel (multi-sheet VN), GET /system/backup-zip (full JSON dump), POST /system/import-all-excel (upsert). New /inventory/xnt (Xuất Nhập Tồn) report per product/material with date range. /stock/movements now accepts date_from/date_to/limit. Production page re-skinned to "Kho hàng hóa" with 4 tabs (XNT default + Lịch sử nhập-xuất + Sản xuất theo ca + AI Gợi ý)
- 2026-05-19: **v2.2 Bug fixes** — extracted `_ensure_dt()` helper to normalise mixed str/naive datetime returned by MongoDB aggregation. Fixed AttributeError 500 in /customers/care, /debts/customers, /insights/customer-scoring, /insights/ai-suggest (cascade). Removed window.confirm from clone handler (smoother UX + Playwright-friendly)

## Pending Backlog (P1)
- Replace native date pickers with shadcn Calendar in /orders filter
- `/api/system/reset-demo` confirm param Optional[str] → 400 instead of 422

## Future (P2)
- Mobile PWA / responsive optimization
- QR ordering for customers
- Loyalty / points system
- Multi-branch & franchise
- GHN / Viettel Post delivery integration
- Real Email/SMS notifications, online payment (VNPay/MoMo/Stripe)

## Refactor opportunities
- `server.py` is 2261 lines — split into routers (system/auth/settings/materials/customers/orders/debts/insights/production/users/reports/chat) + permissions module

## Known Limitations
- Production.create silently over-consumes materials below 0
- Forecast endpoint uses N+1 product lookups (fine <1k products)
- Insights/customer-scoring loops up to 2000 customers in memory (re-evaluate >5k)

## Test Credentials
See `/app/memory/test_credentials.md`
