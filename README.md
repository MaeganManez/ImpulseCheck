# ImpulseCheck

An AI-powered spending intervention app that helps users — especially students — make smarter financial decisions by analyzing purchases in real time, tracking budgets, and flagging impulsive spending.

---

## Features

### Authentication
- **Email & Password** — register with OTP email verification (10-minute expiry)
- **Google OAuth 2.0** — one-click sign-in, auto-creates account on first use
- **QR Code Login** — generate a QR from a logged-in device and scan it on another to log in instantly (30-day token)
- **Forgot Password** — OTP-based password reset flow via email

### Budget Management
- Set a monthly budget with a spending limit and selected categories
- Budget resets each month; previous months are preserved
- Real-time alerts when budget drops to ≤ 20% remaining or is exceeded

### Purchase Recording
- **Manual entry** — item name, price, category, reason, emotion
- **Image scan** — upload a product photo and AI identifies the item, category, estimated price, and impulse risk

### AI Recommendations
- Each purchase is analyzed by **Google Gemini 1.5 Flash**
- Returns a tag (**BUY / WAIT / AVOID**), reasons, personalized advice, and an alternative suggestion
- Context-aware: uses current month's remaining budget and last 5 purchases
- Falls back to a rule-based engine if the API is unavailable

### Spending Reports
- Monthly and weekly stats: total spent, impulsive purchases, amount saved (AVOID decisions)
- Email the report to yourself via **Brevo** with a formatted HTML summary table

### Notifications
- In-app bell with unread count
- Auto-generated for: welcome, budget warnings, budget exceeded, purchase decisions

### Profile & Preferences
- Update name, email, avatar
- Set preferred currency (PHP, USD, EUR, GBP) — applied across all spend displays
- Configure emotion preselection defaults

---

## How It Works

```
User logs in
    ↓
Sets monthly budget + categories
    ↓
Records a purchase (manual or image scan)
    ↓
AI analyzes: item + price + emotion + budget context
    ↓
Returns BUY / WAIT / AVOID with reasoning
    ↓
User makes a decision → saved to history
    ↓
Dashboard + report track totals, savings, impulsive spend
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (Supabase) |
| AI — recommendations | Google Gemini 1.5 Flash |
| AI — image scanning | Groq (Llama 4 Scout 17B) |
| Email | Brevo HTTP API |
| Auth | JWT, bcryptjs, Passport.js, Google OAuth 2.0 |
| Deployment | Backend → Render, Frontend → Vercel / Netlify |

---

## Project Structure

```
ImpulseCheck/
├── impulsecheck-backend/       # Node.js REST API
│   ├── config/
│   │   ├── db.js               # PostgreSQL connection pool
│   │   └── mailer.js           # Brevo email client
│   ├── controllers/
│   │   └── aiController.js     # Gemini + Groq AI logic
│   ├── middleware/
│   │   └── auth.js             # JWT verification middleware
│   ├── routes/
│   │   ├── auth.js             # Register, login, OTP, reset password
│   │   ├── budget.js           # Get/set monthly budget
│   │   ├── purchases.js        # CRUD purchases + report stats
│   │   ├── ai.js               # AI analyze + image scan
│   │   ├── profile.js          # Profile + preferences update
│   │   ├── notifications.js    # Get + mark read
│   │   ├── report.js           # Email spending report
│   │   └── qrauth.js           # QR code generation + verification
│   ├── server.js               # Express app + Google OAuth routes
│   ├── .env                    # Local secrets (not committed)
│   └── .env.example            # Template for required env vars
│
└── impulsecheck-html/          # Static frontend
    ├── config.js               # API base URL config
    ├── api.js                  # Shared fetch wrapper + API methods
    ├── notifications.js        # Notification bell component
    ├── shared.css              # Global styles + CSS variables
    ├── dashboard.html          # Main dashboard
    ├── record-purchase.html    # Record purchase + AI trigger
    ├── ai-recommendation.html  # AI result display
    ├── set-budget.html         # Budget setup
    ├── spending-report.html    # Stats + email report
    ├── profile.html            # Profile editor
    ├── login.html              # Login (email / Google / QR)
    ├── register.html           # Registration
    ├── verify-otp.html         # OTP verification
    ├── forgot-password.html    # Password reset
    ├── qr-approve.html         # QR login approval screen
    ├── oauth-callback.html     # Google OAuth redirect handler
    └── help.html               # FAQ
```

---

## Environment Variables

Copy `.env.example` to `.env` inside `impulsecheck-backend/` and fill in the values:

```env
PORT=5000

# PostgreSQL (Supabase)
DB_HOST=
DB_PORT=5432
DB_USER=
DB_PASSWORD=
DB_NAME=postgres

# Auth
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI
GEMINI_API_KEY=
GROQ_API_KEY=

# Email
BREVO_API_KEY=
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=

# URLs
BACKEND_URL=https://your-backend.onrender.com
FRONTEND_URL=https://your-frontend.vercel.app
```

---

## Running Locally

```bash
# Backend
cd impulsecheck-backend
npm install
cp .env.example .env   # fill in your values
node server.js         # runs on http://localhost:5000

# Frontend
# Open impulsecheck-html/index.html in a browser
# or serve with: npx serve impulsecheck-html
```

Update `impulsecheck-html/config.js` to point to your local backend:

```js
window.IC_API_BASE = 'http://localhost:5000/api';
```

---

## Deployment

**Backend (Render)**
1. Connect the `impulsecheck-backend/` folder to a Render Web Service
2. Add all environment variables from `.env.example` in the Render dashboard
3. Start command: `node server.js`

**Frontend (Vercel / Netlify)**
1. Deploy the `impulsecheck-html/` folder as a static site
2. Set `window.IC_API_BASE` in `config.js` to your Render backend URL before deploying
