-- ============================================================
-- FinTrack — Migration 004
-- Monthly spending alerts per category (+ optional description)
-- ============================================================
-- Run AFTER 003_billing_cycles.sql
-- ============================================================

create table public.spending_alerts (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid not null references public.categories(id) on delete cascade,
  description_pattern text,                               -- optional, matched against description/merchant (contains, case-insensitive)
  monthly_limit       numeric(12,2) not null check (monthly_limit > 0),
  threshold_pct       smallint not null default 80 check (threshold_pct between 1 and 100),
  is_active           boolean not null default true,
  -- Notification state: avoids re-sending the same alert level within a month
  last_alert_month    date,
  last_alert_level    text check (last_alert_level in ('warning', 'exceeded')),
  created_at          timestamptz not null default now()
);

create index idx_spending_alerts_category on public.spending_alerts(category_id);

alter table public.spending_alerts enable row level security;

create policy "Authenticated full access" on public.spending_alerts
  for all using (auth.role() = 'authenticated');
