-- ============================================================
-- FinTrack — Migration 002
-- Credit card billing cycles, payments, transfers, balance tracking
-- ============================================================
-- Run this AFTER 001_initial_schema.sql in the Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. Extend accounts table with balance + credit card fields
-- ============================================================
alter table public.accounts
  add column if not exists balance         numeric(12,2) not null default 0,
  add column if not exists credit_limit    numeric(12,2),                  -- only for credit_card type
  add column if not exists statement_day   smallint check (statement_day between 1 and 31),  -- day of month statement closes
  add column if not exists due_day         smallint check (due_day between 1 and 31);        -- day of month payment is due

-- For credit cards: balance represents amount OWED (positive = debt)
-- For checking/cash: balance represents money available

comment on column public.accounts.balance is
  'Credit cards: amount owed (positive). Other accounts: available money.';

-- ============================================================
-- 2. Credit card payments
-- ============================================================
create table public.cc_payments (
  id                    uuid primary key default gen_random_uuid(),
  credit_card_id        uuid not null references public.accounts(id) on delete cascade,
  from_account_id       uuid not null references public.accounts(id) on delete restrict,
  amount                numeric(12,2) not null check (amount > 0),
  payment_date          date not null default current_date,
  notes                 text,
  created_at            timestamptz not null default now()
);

create index idx_cc_payments_card on public.cc_payments(credit_card_id);
create index idx_cc_payments_date on public.cc_payments(payment_date desc);

-- ============================================================
-- 3. Account transfers (between non-credit accounts only)
-- ============================================================
create table public.transfers (
  id                    uuid primary key default gen_random_uuid(),
  from_account_id       uuid not null references public.accounts(id) on delete restrict,
  to_account_id         uuid not null references public.accounts(id) on delete restrict,
  amount                numeric(12,2) not null check (amount > 0),
  transfer_date         date not null default current_date,
  notes                 text,
  created_at            timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

create index idx_transfers_date on public.transfers(transfer_date desc);

-- ============================================================
-- 4. Validation: transfers cannot involve credit cards
-- ============================================================
create or replace function public.validate_transfer_accounts()
returns trigger as $$
declare
  from_type text;
  to_type   text;
begin
  select type into from_type from public.accounts where id = new.from_account_id;
  select type into to_type   from public.accounts where id = new.to_account_id;

  if from_type = 'credit_card' or to_type = 'credit_card' then
    raise exception 'Transfers cannot involve credit card accounts. Use cc_payments instead.';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger validate_transfer_accounts_trigger
  before insert or update on public.transfers
  for each row execute function public.validate_transfer_accounts();

-- ============================================================
-- 5. Validation: cc_payments must target a credit_card
-- ============================================================
create or replace function public.validate_cc_payment_accounts()
returns trigger as $$
declare
  cc_type   text;
  from_type text;
begin
  select type into cc_type   from public.accounts where id = new.credit_card_id;
  select type into from_type from public.accounts where id = new.from_account_id;

  if cc_type <> 'credit_card' then
    raise exception 'credit_card_id must reference a credit_card account';
  end if;

  if from_type = 'credit_card' then
    raise exception 'Cannot pay a credit card from another credit card';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger validate_cc_payment_accounts_trigger
  before insert or update on public.cc_payments
  for each row execute function public.validate_cc_payment_accounts();

-- ============================================================
-- 6. Balance update triggers
-- ============================================================

-- When a transaction is inserted/updated/deleted, adjust account balance
create or replace function public.update_balance_on_transaction()
returns trigger as $$
declare
  acc_type text;
  delta    numeric(12,2);
begin
  if tg_op = 'INSERT' then
    if new.account_id is null then return new; end if;
    select type into acc_type from public.accounts where id = new.account_id;
    -- For credit cards: expenses INCREASE balance (debt grows)
    -- For others: expenses DECREASE balance
    if acc_type = 'credit_card' then
      update public.accounts set balance = balance + new.amount where id = new.account_id;
    else
      update public.accounts set balance = balance - new.amount where id = new.account_id;
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    if old.account_id is null then return old; end if;
    select type into acc_type from public.accounts where id = old.account_id;
    if acc_type = 'credit_card' then
      update public.accounts set balance = balance - old.amount where id = old.account_id;
    else
      update public.accounts set balance = balance + old.amount where id = old.account_id;
    end if;
    return old;

  elsif tg_op = 'UPDATE' then
    -- Reverse old, apply new
    if old.account_id is not null then
      select type into acc_type from public.accounts where id = old.account_id;
      if acc_type = 'credit_card' then
        update public.accounts set balance = balance - old.amount where id = old.account_id;
      else
        update public.accounts set balance = balance + old.amount where id = old.account_id;
      end if;
    end if;
    if new.account_id is not null then
      select type into acc_type from public.accounts where id = new.account_id;
      if acc_type = 'credit_card' then
        update public.accounts set balance = balance + new.amount where id = new.account_id;
      else
        update public.accounts set balance = balance - new.amount where id = new.account_id;
      end if;
    end if;
    return new;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger update_balance_on_transaction_trigger
  after insert or update or delete on public.transactions
  for each row execute function public.update_balance_on_transaction();

-- When a CC payment is made, decrease CC balance + decrease source account
create or replace function public.update_balance_on_cc_payment()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.accounts set balance = balance - new.amount where id = new.credit_card_id;
    update public.accounts set balance = balance - new.amount where id = new.from_account_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.accounts set balance = balance + old.amount where id = old.credit_card_id;
    update public.accounts set balance = balance + old.amount where id = old.from_account_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger update_balance_on_cc_payment_trigger
  after insert or delete on public.cc_payments
  for each row execute function public.update_balance_on_cc_payment();

-- When a transfer happens, move money between accounts
create or replace function public.update_balance_on_transfer()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.accounts set balance = balance - new.amount where id = new.from_account_id;
    update public.accounts set balance = balance + new.amount where id = new.to_account_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.accounts set balance = balance + old.amount where id = old.from_account_id;
    update public.accounts set balance = balance - old.amount where id = old.to_account_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger update_balance_on_transfer_trigger
  after insert or delete on public.transfers
  for each row execute function public.update_balance_on_transfer();

-- ============================================================
-- 7. Helper function: get current billing cycle for a CC
-- ============================================================
-- Given a credit card with statement_day, returns the start/end of the
-- CURRENT open billing cycle (the one not yet closed).
create or replace function public.current_billing_cycle(card_id uuid)
returns table(cycle_start date, cycle_end date, due_date date) as $$
declare
  stmt_day  smallint;
  due_d     smallint;
  today     date := current_date;
  this_stmt date;
begin
  select statement_day, due_day into stmt_day, due_d
  from public.accounts where id = card_id;

  if stmt_day is null then
    -- No statement day set; return rolling 30-day window
    return query select today - interval '30 days', today, today + interval '15 days';
    return;
  end if;

  -- Statement closes on stmt_day each month. The current OPEN cycle:
  -- starts the day after the LAST statement close, ends on the NEXT statement close.
  this_stmt := make_date(extract(year from today)::int, extract(month from today)::int, stmt_day);

  if today > this_stmt then
    -- Last close already passed this month; cycle ends next month
    cycle_start := this_stmt + 1;
    cycle_end   := (this_stmt + interval '1 month')::date;
  else
    -- Current cycle ends this month
    cycle_start := (this_stmt - interval '1 month' + interval '1 day')::date;
    cycle_end   := this_stmt;
  end if;

  -- Due date: next due_day after cycle_end
  if due_d is not null then
    due_date := make_date(extract(year from cycle_end)::int, extract(month from cycle_end)::int, due_d);
    if due_date <= cycle_end then
      due_date := (due_date + interval '1 month')::date;
    end if;
  else
    due_date := cycle_end + interval '21 days';
  end if;

  return next;
end;
$$ language plpgsql;

-- ============================================================
-- 8. View: credit card status (balance, cycle, available credit)
-- ============================================================
create or replace view public.credit_card_status as
select
  a.id,
  a.name,
  a.balance                              as amount_owed,
  a.credit_limit,
  case when a.credit_limit is not null
       then a.credit_limit - a.balance
       else null end                     as available_credit,
  case when a.credit_limit is not null and a.credit_limit > 0
       then round((a.balance / a.credit_limit) * 100, 1)
       else null end                     as utilization_pct,
  a.statement_day,
  a.due_day,
  c.cycle_start,
  c.cycle_end,
  c.due_date,
  -- Spending in current cycle
  coalesce((
    select sum(t.amount)
    from public.transactions t
    where t.account_id = a.id
      and t.date between c.cycle_start and c.cycle_end
      and t.amount > 0
  ), 0) as cycle_spending
from public.accounts a
cross join lateral public.current_billing_cycle(a.id) c
where a.type = 'credit_card' and a.is_active = true;

-- ============================================================
-- 9. RLS for new tables
-- ============================================================
alter table public.cc_payments enable row level security;
alter table public.transfers   enable row level security;

create policy "Authenticated full access" on public.cc_payments
  for all using (auth.role() = 'authenticated');

create policy "Authenticated full access" on public.transfers
  for all using (auth.role() = 'authenticated');

-- ============================================================
-- 10. Backfill existing balances from existing transactions
-- (only run once; safe to re-run because triggers handle future changes)
-- ============================================================
-- Reset all balances to 0
update public.accounts set balance = 0;

-- Recalc from transactions
update public.accounts a
set balance = coalesce((
  select case when a.type = 'credit_card'
              then sum(amount)
              else -sum(amount) end
  from public.transactions
  where account_id = a.id
), 0);

-- Apply existing CC payments (if any)
update public.accounts a
set balance = balance - coalesce((
  select sum(amount) from public.cc_payments where credit_card_id = a.id
), 0)
where a.type = 'credit_card';

update public.accounts a
set balance = balance - coalesce((
  select sum(amount) from public.cc_payments where from_account_id = a.id
), 0)
where a.type <> 'credit_card';

-- Apply existing transfers (if any)
update public.accounts a
set balance = balance
  - coalesce((select sum(amount) from public.transfers where from_account_id = a.id), 0)
  + coalesce((select sum(amount) from public.transfers where to_account_id   = a.id), 0);
