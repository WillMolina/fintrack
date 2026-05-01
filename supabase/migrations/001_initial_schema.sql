-- ============================================================
-- FinTrack — Initial Schema Migration
-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Accounts (credit cards, bank accounts, cash, etc.)
create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                          -- "Chase Sapphire", "Bank of America Checking"
  type        text not null check (type in ('credit_card', 'debit', 'checking', 'savings', 'cash', 'other')),
  currency    text not null default 'USD',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 2. Categories
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  icon        text,                                   -- emoji or icon name
  color       text,                                   -- hex color for charts
  created_at  timestamptz not null default now()
);

-- 3. Transactions
create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  amount        numeric(12,2) not null,               -- positive = expense, negative = income
  description   text not null,
  merchant      text,
  date          date not null default current_date,
  category_id   uuid references public.categories(id) on delete set null,
  account_id    uuid references public.accounts(id) on delete set null,
  source        text not null default 'manual' check (source in ('manual', 'webhook', 'import')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 4. Budgets (optional, monthly limits per category)
create table public.budgets (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.categories(id) on delete cascade,
  month         date not null,                        -- first day of the month, e.g. '2026-04-01'
  amount_limit  numeric(12,2) not null,
  created_at    timestamptz not null default now(),
  unique(category_id, month)
);

-- ============================================================
-- Indexes for common queries
-- ============================================================
create index idx_transactions_date on public.transactions(date desc);
create index idx_transactions_category on public.transactions(category_id);
create index idx_transactions_account on public.transactions(account_id);
create index idx_transactions_source on public.transactions(source);
create index idx_budgets_month on public.budgets(month);

-- ============================================================
-- Auto-update updated_at on transactions
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_transaction_update
  before update on public.transactions
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Useful views
-- ============================================================

-- Monthly spending by category
create or replace view public.monthly_category_totals as
select
  date_trunc('month', t.date)::date as month,
  c.name as category,
  c.color,
  c.icon,
  sum(t.amount) as total,
  count(*) as tx_count
from public.transactions t
left join public.categories c on c.id = t.category_id
where t.amount > 0  -- expenses only
group by date_trunc('month', t.date), c.name, c.color, c.icon
order by month desc, total desc;

-- Monthly summary (total income vs expenses)
create or replace view public.monthly_summary as
select
  date_trunc('month', date)::date as month,
  sum(case when amount > 0 then amount else 0 end) as total_expenses,
  sum(case when amount < 0 then abs(amount) else 0 end) as total_income,
  sum(amount) as net,
  count(*) as tx_count
from public.transactions
group by date_trunc('month', date)
order by month desc;

-- ============================================================
-- Row Level Security (single-user, allow everything for authed)
-- ============================================================
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

-- Allow all operations for any authenticated user
-- Since this is single-user, this is sufficient.
-- If you later add multi-user, add a user_id column and filter by auth.uid().
create policy "Authenticated full access" on public.accounts
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on public.categories
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on public.transactions
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on public.budgets
  for all using (auth.role() = 'authenticated');

-- ============================================================
-- Seed data: default categories
-- ============================================================
insert into public.categories (name, icon, color) values
  ('Food & Dining',     '🍽️', '#ef4444'),
  ('Transport',         '🚗', '#f59e0b'),
  ('Housing',           '🏠', '#3b82f6'),
  ('Subscriptions',     '🔄', '#8b5cf6'),
  ('Entertainment',     '🎬', '#ec4899'),
  ('Health',            '💊', '#10b981'),
  ('Utilities',         '⚡', '#06b6d4'),
  ('Other',             '📦', '#71717a');

-- ============================================================
-- Seed data: example account (customize to your cards)
-- ============================================================
insert into public.accounts (name, type) values
  ('Primary Credit Card', 'credit_card'),
  ('Checking Account',    'checking'),
  ('Cash',                'cash');
