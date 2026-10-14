-- ============================================================
-- FinTrack — Migration 005
-- Category auto-fill rules (pattern on description/merchant → category)
-- ============================================================
-- Run AFTER 004_spending_alerts.sql
-- ============================================================

create table public.category_rules (
  id          uuid primary key default gen_random_uuid(),
  pattern     text not null,                -- comma-separated terms, "-term" excludes (same syntax as alerts)
  category_id uuid not null references public.categories(id) on delete cascade,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index idx_category_rules_category on public.category_rules(category_id);

alter table public.category_rules enable row level security;

create policy "Authenticated full access" on public.category_rules
  for all using (auth.role() = 'authenticated');
