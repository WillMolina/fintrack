# 💰 FinTrack — Personal Finance Tracker

A personal finance dashboard built with **Next.js 14**, **Supabase**, and **Tailwind CSS**.  
Designed to be fast to build, free to run, and ready for future mobile apps.

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Make.com   │────▶│ POST /api/   │────▶│   Supabase   │
│ (email →    │     │   webhook    │     │  PostgreSQL  │
│  parse CC)  │     └──────────────┘     └──────┬───────┘
└─────────────┘                                 │
                                                │ REST API
┌─────────────┐     ┌──────────────┐            │
│ Future      │────▶│ Supabase SDK │────────────┘
│ Mobile App  │     └──────────────┘
└─────────────┘
                    ┌──────────────┐            │
                    │   Next.js    │────────────┘
                    │  Dashboard   │
                    └──────────────┘
```

---

## Quick Start (15 minutes)

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy your **Project URL** and **anon key** from Settings → API

### 2. Run the Database Migrations

In your Supabase dashboard, go to **SQL Editor** → **New Query**, then run each migration in order:

1. Paste & run `supabase/migrations/001_initial_schema.sql` — creates tables, views, default categories
2. Paste & run `supabase/migrations/002_credit_cards_and_transfers.sql` — adds CC billing cycles, payments, transfers, and balance tracking
3. Paste & run `supabase/migrations/003_billing_cycles.sql` — adds per-cycle tracking with open/closed status

### 3. Set Up Auth (Single User)

1. In Supabase dashboard → **Authentication** → **Users**
2. Click "Add user" → enter your email and password
3. That's it — you're the only user.

### 4. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
WEBHOOK_SECRET=<any-random-string>
```

### 5. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Deploy to Vercel

```bash
npx vercel
```

Add the same environment variables in Vercel dashboard → Settings → Environment Variables.

---

## Make.com Webhook Setup

Replace your current "Google Sheets" module with an **HTTP** module:

1. In your Make.com scenario, after the email parsing step
2. Add an **HTTP → Make a Request** module:
   - **URL**: `https://your-vercel-url.vercel.app/api/webhook`
   - **Method**: POST
   - **Headers**:
     - `Content-Type`: `application/json`
     - `x-webhook-secret`: same value as your `WEBHOOK_SECRET`
   - **Body** (JSON):
     ```json
     {
       "amount": {{parsed_amount}},
       "description": "{{parsed_description}}",
       "merchant": "{{parsed_merchant}}",
       "date": "{{parsed_date}}",
       "category": "{{parsed_category}}",
       "account": "Primary Credit Card"
     }
     ```
3. Remove or disable the Google Sheets module

The webhook resolves category and account by name (fuzzy match), so you don't need to pass UUIDs.

---

## Project Structure

```
fintrack/
├── app/
│   ├── layout.tsx                 # Root layout + sidebar
│   ├── page.tsx                   # Redirects to /dashboard
│   ├── globals.css                # Tailwind + custom styles
│   ├── dashboard/
│   │   ├── page.tsx               # Dashboard (server component)
│   │   ├── spending-chart.tsx     # Recharts bar chart
│   │   ├── category-breakdown.tsx # Category progress bars
│   │   └── recent-transactions.tsx
│   ├── transactions/
│   │   ├── page.tsx               # Transaction list + add form
│   │   ├── add-transaction-form.tsx
│   │   └── transaction-list.tsx
│   ├── categories/
│   │   ├── page.tsx               # Category management
│   │   └── category-manager.tsx
│   └── api/
│       └── webhook/
│           └── route.ts           # Make.com webhook endpoint
├── components/ui/
│   └── sidebar.tsx                # Navigation sidebar
├── lib/
│   ├── supabase-browser.ts        # Client-side Supabase
│   ├── supabase-server.ts         # Server-side Supabase
│   ├── types.ts                   # TypeScript interfaces
│   └── utils.ts                   # Formatters & helpers
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # Full DB schema
├── .env.local.example
├── tailwind.config.js
└── package.json
```

---

## What's Next

- [ ] Add login page (Supabase Auth UI)
- [ ] CSV import for historical Google Sheets data
- [ ] Budget tracking with alerts
- [ ] Recurring transactions
- [ ] Mobile app with Expo + React Native (same Supabase backend)
- [ ] Dark/light theme toggle
