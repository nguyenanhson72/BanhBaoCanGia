# Bánh Bao Admin v2 - Test Credentials

## Admin Account (only seeded user)
- Email: `admin@banhbao.vn`
- Password: `admin123`
- Role: `admin` (full access to all 38 permissions)
- Auth provider: `local` (JWT)

## How to create additional users
Login as admin → Sidebar → Nhân viên → Thêm mới
Choose role from: admin / manager / coordinator / warehouse / accountant / shipper / staff
Optionally toggle "Phân quyền tùy chỉnh" to override role defaults with a checkbox grid.

## Roles & Default Permissions
| Role | Key permissions |
|---|---|
| admin | ALL (38 keys) |
| manager | All except users.* and settings.edit |
| coordinator | orders.view/create/edit/print, customers view/create/edit, delivery.*, debts.view, reports.view |
| warehouse | products + materials + stock.* + suppliers + reports.view |
| accountant | orders.view/print, customers/suppliers view, debts.view/collect/pay/remind, reports view + export |
| shipper | orders.view + delivery.view + delivery.bill (NO customers list) |
| staff | basic orders.view/create + products.view + customers.view/create + reports.view |

## Google OAuth (Emergent-managed)
- "Đăng nhập với Google" button on login screen
- New Google logins are auto-created with `staff` role
- Existing email retains current role

## Auth endpoints
- POST /api/auth/login (email/password → cookies)
- POST /api/auth/register (admin or self-signup; staff is default)
- POST /api/auth/logout
- GET  /api/auth/me (returns user + permissions_effective)
- POST /api/auth/refresh
- POST /api/auth/session (Emergent OAuth via X-Session-ID header)

## Cookies set
- `access_token` (httpOnly, 12h) — JWT
- `refresh_token` (httpOnly, 7d) — JWT
- `session_token` (httpOnly, 7d) — Google OAuth

## Brute force protection
- 5 failed logins / 15 min lockout per (IP + email)

## Demo data
- Wiped by default. To reset use: Settings → Khu vực nguy hiểm → "Xóa toàn bộ dữ liệu demo"
- Or POST /api/system/reset-demo?confirm=YES_DELETE (admin only)
