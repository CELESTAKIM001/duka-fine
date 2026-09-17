# DukaFine — Kenyan Multi-Tenant E-Commerce MVP

A production-oriented MVP using:

- Flask API backend
- MongoDB Atlas
- React + Tailwind CSS frontend
- JWT authentication with persistent browser session
- Email OTP verification on signup (animated code entry modal, resend cooldown, 10-minute expiry)
- Multi-vendor stores/products
- Inventory pre-check before payment
- Safaricom Daraja Lipa Na M-Pesa Online Buy Goods STK Push
- M-Pesa callback matching to order
- Buyer + seller email receipts/notifications
- WhatsApp product sharing utility
- Admin dashboard + audit logs
- Vercel deployment configuration

## 1. Local setup

### Backend

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env
python seed.py
python -m flask --app api/index.py run
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL=http://localhost:5000/api` for local development.

## 2. MongoDB

Create a MongoDB Atlas database and put the connection string in:

`MONGODB_URI`

The application creates these collections automatically:

- users
- stores
- products
- orders
- payments
- audit_logs

## 3. Daraja Buy Goods configuration

This project intentionally separates the head-office shortcode from the vendor's actual Buy Goods Till.

For a Buy Goods transaction:

- `MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline`
- `MPESA_BUSINESS_SHORT_CODE` = authorized head-office shortcode / organization shortcode used by the Daraja account
- `MPESA_VENDOR_TILL` = vendor's actual Buy Goods Till
- `PartyA` = customer Safaricom phone number
- `PartyB` = vendor Buy Goods Till
- `PhoneNumber` = customer Safaricom phone number

Do NOT put a Paybill in `MPESA_VENDOR_TILL`.

The project does not contain real Safaricom credentials. Replace all placeholders in `.env`.

## 4. Email

SMTP is used for receipts, seller notifications, and signup OTP verification codes. Gmail, Outlook SMTP, Amazon SES, SendGrid SMTP, Mailgun SMTP or another transactional SMTP provider can be used.

### Email OTP verification

New accounts are created with `is_verified: false`. Registration emails a 6-digit code (`OTP_EXPIRY_MINUTES`, default 10 min) and the frontend shows an animated pop-up to enter it. Login is blocked with `403 email_not_verified` until the code is confirmed.

Endpoints:

- `POST /api/auth/register` → creates the account, emails the code, returns `{ requires_verification: true }` (no token yet)
- `POST /api/auth/verify-otp` → `{ email, otp }` → returns `{ token, user }` on success
- `POST /api/auth/resend-otp` → `{ email }` → rate-limited by `OTP_RESEND_COOLDOWN_SECONDS` (default 60s)

If `SMTP_*` isn't configured (e.g. local dev without email), the code is written to the server log instead of failing the request — configure SMTP before going to production so users actually receive it.

## 5. Vercel

The root `vercel.json` routes `/api/*` to Flask and serves the React build as a static application.

Recommended production deployment:

```bash
npm --prefix frontend install
npm --prefix frontend run build
vercel --prod
```

Add all `.env.example` variables to Vercel Project Settings → Environment Variables.

For production, use MongoDB Atlas and a transactional email provider rather than a development/local SMTP server.

## 6. Admin

Set:

`ADMIN_EMAIL=admin@example.com`

The first user created with this exact email receives the admin role.

Admin endpoints:

- `GET /api/admin/stats`
- `GET /api/admin/orders`
- `GET /api/admin/logs`
- `GET /api/admin/stores`
