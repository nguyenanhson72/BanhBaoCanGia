# Bánh Bao Admin - Test Credentials

## Admin Account (full access)
- Email: `admin@banhbao.vn`
- Password: `admin123`
- Role: `admin`
- Auth provider: `local` (JWT email/password)

## Staff Account (read-only with limited CRUD)
- Email: `staff@banhbao.vn`
- Password: `staff123`
- Role: `staff`
- Auth provider: `local`

## Google OAuth (Emergent-managed)
- Any Google account can sign in via the Login screen "Đăng nhập với Google" button
- New Google accounts are auto-created with `staff` role
- Existing accounts with the same email retain their role

## Auth Endpoints (all prefixed with /api)
- `POST /api/auth/login` — email/password login (JWT cookies)
- `POST /api/auth/register` — admin-only via Users page; also direct call
- `POST /api/auth/logout` — clears cookies + session
- `GET  /api/auth/me` — current user (cookie OR Bearer OR session_token)
- `POST /api/auth/refresh` — refresh access token from refresh cookie
- `POST /api/auth/session` — exchange Emergent OAuth `session_id` for app session (X-Session-ID header)

## Cookies set
- `access_token` (httpOnly, 12h) — JWT login
- `refresh_token` (httpOnly, 7d) — JWT login
- `session_token` (httpOnly, 7d) — Google OAuth

## RBAC matrix
- admin: full CRUD on all modules, manage users
- manager: CRUD products/suppliers/customers/orders, view users
- staff: CRUD customers/orders, view-only products/suppliers/reports
