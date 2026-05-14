# Bánh Bao Admin — Product Requirements Document (PRD)

## Original Problem Statement
Internal management dashboard for a Vietnamese steamed bun (bánh bao) shop. Optimized feature list with modules for orders, products, customers/suppliers, staff (RBAC), reports, settings, and an AI chatbot assistant. Multi-language (Vietnamese + English). Authentication via JWT email/password AND Emergent-managed Google OAuth.

## Tech Stack
- Backend: FastAPI + Motor (MongoDB) + bcrypt + PyJWT + emergentintegrations (Claude Sonnet 4.5)
- Frontend: React 18 + React Router + TailwindCSS + Recharts + Lucide icons (no shadcn dep)
- Auth: JWT (access 12h, refresh 7d) via httpOnly cookies + Emergent Google OAuth session_token
- AI: Anthropic Claude Sonnet 4.5 via Universal Emergent LLM Key

## User Personas
- **Owner / Admin** — full control: dashboard, all CRUD, manage staff, configure system
- **Manager** — operational lead: orders, products, suppliers, customers, reports
- **Staff** — POS/cashier: take orders, manage customers, view products/inventory

## Core Modules Implemented (v0.1)
1. **Authentication**
   - JWT email/password login + register
   - Google OAuth via Emergent
   - Brute-force lockout (5 fails / 15 min)
   - Refresh token
2. **Dashboard** — KPIs (today revenue/orders/debt/products), 7-day revenue line chart, top 5 best sellers, low stock list, recent orders list
3. **Orders** — list with filters (status/payment/text), create new (autocomplete customer + product picker), detail view with **timeline of status changes**, status update with notes, automatic stock decrement on create / restore on cancel
4. **Products** — grid view with images, low stock badge, filter by category + low-stock-only, full CRUD (admin/manager), variants schema-ready
5. **Customers** — table with group filter (vip/regular/new), full CRUD, auto-computed total_orders & total_spent
6. **Suppliers** — card view with rating stars, full CRUD
7. **Users (Staff)** — admin-only RBAC management (admin/manager/staff), create with password, update role/password
8. **Reports**
   - Revenue (daily 30d / weekly 12w / monthly 12m) bar chart
   - Debt by customer (COD unpaid orders)
   - Inventory (total value, low stock count, OOS count, per-product valuation)
9. **AI Chatbot "Bao"** — floating widget, Claude Sonnet 4.5, multi-turn memory in MongoDB, gets live business context (today revenue, pending orders, low stock) injected into system prompt
10. **i18n** — Vietnamese (default) + English, full coverage across UI, persisted in localStorage
11. **Settings** — company info form, language selector, integrations status, account info

## Seeded Demo Data
- 2 users (admin, staff)
- 6 products (banh bao variants with images)
- 5 customers (vip/regular/new mix)
- 3 suppliers
- ~25 orders spread over last 7 days with mixed statuses & payment methods

## Implementation Date
- **2026-05-14**: MVP delivered (all P0/P1 features above)
- **2026-05-14 (later)**: Iteration 2 — 13 user-requested improvements:
  - Orders default sort by created_at DESC (newest first)
  - Print + PDF export on Reports (Revenue / Debt / Inventory) via html2pdf.js
  - Print + PDF export on Orders list (filter-aware)
  - Print bill in 2 formats from Order detail: 80mm thermal + A4 invoice
  - Bill template minimal: shop name, order code, customer info, items (name/price/qty/subtotal), totals, purchase date + print date
  - Product image upload from computer (base64, max 500KB) — both file upload button and URL fallback
  - Searchable typeahead Combobox for customer + product in New Order (no more dropdown)
  - Auto-fill customer address on selection in New Order
  - Show product stock badge when picking item; warn if quantity exceeds stock
  - Inventory report adds "Hàng âm" (negative stock) KPI card + dedicated red alert section
  - Discount % field on New Order (in addition to fixed VND discount); both deduct from total
  - Date range filter (Từ ngày / Đến ngày) on Orders list AND Reports Revenue
  - Backend `/api/reports/revenue` now accepts `date_from` + `date_to` for custom daily buckets

## Backlog (Future)
- **P1**: Email notifications (SendGrid), Excel/PDF export, audit logs, password reset flow
- **P2**: VNPay/MoMo online payment, SMS via Twilio, shipping integrations (GHN/Viettel Post)
- **P2**: Variant management UI for products
- **P3**: PWA offline mode, image upload to S3/Cloudflare
- **P3**: Customer-facing storefront (out of MVP scope)

## Known Limitations
- Email/SMS notifications are NOT implemented (MOCKED — only console / no real send)
- Online payment is NOT integrated (only manual ghi nhận: cash/transfer/COD/card)
- Reports export to PDF/Excel is NOT implemented (UI placeholder)
- 2FA NOT implemented yet (RBAC only)

## Test Credentials
See `/app/memory/test_credentials.md`
