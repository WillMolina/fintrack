-- ============================================================
-- FinTrack — Migration 003
-- Billing cycles for credit cards
-- ============================================================
-- Run AFTER 002_credit_cards_and_transfers.sql
-- ============================================================

-- ============================================================
-- 1. Billing cycles table
-- ============================================================
create table public.billing_cycles (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.accounts(id) on delete cascade,
  cycle_start     date not null,
  cycle_end       date not null,
  due_date        date not null,
  status          text not null default 'open' check (status in ('open', 'closed', 'paid')),
  statement_balance numeric(12,2),  -- amount owed when cycle closed
  created_at      timestamptz not null default now(),
  unique(account_id, cycle_start)
);

create index idx_billing_cycles_account on public.billing_cycles(account_id);
create index idx_billing_cycles_status on public.billing_cycles(status);
create index idx_billing_cycles_due on public.billing_cycles(due_date);

-- ============================================================
-- 2. Add billing_cycle_id to transactions
-- ============================================================
alter table public.transactions
  add column if not exists billing_cycle_id uuid references public.billing_cycles(id) on delete set null;

create index idx_transactions_billing_cycle on public.transactions(billing_cycle_id);

-- ============================================================
-- 3. Function: ensure a billing cycle exists for a CC + date
-- Generates the cycle if missing based on the card's statement_day
-- ============================================================
create or replace function public.ensure_billing_cycle(
  p_account_id uuid,
  p_date date
) returns uuid as $$
declare
  v_stmt_day  smallint;
  v_due_day   smallint;
  v_acc_type  text;
  v_cycle_id  uuid;
  v_cycle_start date;
  v_cycle_end   date;
  v_due_date    date;
  v_year int;
  v_month int;
  v_this_stmt date;
begin
  select type, statement_day, due_day into v_acc_type, v_stmt_day, v_due_day
  from public.accounts where id = p_account_id;

  -- Only credit cards have billing cycles
  if v_acc_type <> 'credit_card' then
    return null;
  end if;

  -- If no statement day configured, can't create cycle
  if v_stmt_day is null then
    return null;
  end if;

  -- Compute cycle for the given date
  v_year  := extract(year from p_date)::int;
  v_month := extract(month from p_date)::int;
  v_this_stmt := make_date(v_year, v_month, least(v_stmt_day, 28));

  if p_date > v_this_stmt then
    -- Charge happened after this month's statement: belongs to NEXT cycle
    v_cycle_start := v_this_stmt + 1;
    v_cycle_end   := (v_this_stmt + interval '1 month')::date;
  else
    -- Charge happened on/before this month's statement: belongs to cycle that ENDS on v_this_stmt
    v_cycle_start := (v_this_stmt - interval '1 month' + interval '1 day')::date;
    v_cycle_end   := v_this_stmt;
  end if;

  -- Compute due date
  if v_due_day is not null then
    v_due_date := make_date(
      extract(year from v_cycle_end)::int,
      extract(month from v_cycle_end)::int,
      least(v_due_day, 28)
    );
    if v_due_date <= v_cycle_end then
      v_due_date := (v_due_date + interval '1 month')::date;
    end if;
  else
    v_due_date := v_cycle_end + interval '21 days';
  end if;

  -- Find or create the cycle
  select id into v_cycle_id
  from public.billing_cycles
  where account_id = p_account_id and cycle_start = v_cycle_start;

  if v_cycle_id is null then
    insert into public.billing_cycles (account_id, cycle_start, cycle_end, due_date, status)
    values (p_account_id, v_cycle_start, v_cycle_end, v_due_date, 'open')
    returning id into v_cycle_id;
  end if;

  return v_cycle_id;
end;
$$ language plpgsql;

-- ============================================================
-- 4. Trigger: auto-assign billing_cycle_id on insert/update
-- ============================================================
create or replace function public.assign_billing_cycle()
returns trigger as $$
declare
  v_acc_type text;
begin
  if new.account_id is null then
    new.billing_cycle_id := null;
    return new;
  end if;

  select type into v_acc_type from public.accounts where id = new.account_id;

  if v_acc_type = 'credit_card' then
    new.billing_cycle_id := public.ensure_billing_cycle(new.account_id, new.date);
  else
    new.billing_cycle_id := null;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists assign_billing_cycle_trigger on public.transactions;
create trigger assign_billing_cycle_trigger
  before insert or update of account_id, date on public.transactions
  for each row execute function public.assign_billing_cycle();

-- ============================================================
-- 5. View: cycle summary (totals, status, payment progress)
-- ============================================================
create or replace view public.billing_cycle_summary as
select
  bc.id,
  bc.account_id,
  a.name as account_name,
  a.credit_limit,
  bc.cycle_start,
  bc.cycle_end,
  bc.due_date,
  bc.status,
  bc.statement_balance,
  coalesce(sum(t.amount), 0) as cycle_spending,
  count(t.id) as transaction_count,
  -- Total payments toward this cycle (approximation: payments after cycle_end)
  coalesce((
    select sum(p.amount)
    from public.cc_payments p
    where p.credit_card_id = bc.account_id
      and p.payment_date between bc.cycle_end and bc.due_date + interval '7 days'
  ), 0) as paid_amount
from public.billing_cycles bc
join public.accounts a on a.id = bc.account_id
left join public.transactions t on t.billing_cycle_id = bc.id
group by bc.id, a.name, a.credit_limit, bc.cycle_start, bc.cycle_end,
         bc.due_date, bc.status, bc.statement_balance, bc.account_id
order by bc.cycle_end desc;

-- ============================================================
-- 6. Function: close a billing cycle (snapshots balance)
-- ============================================================
create or replace function public.close_billing_cycle(p_cycle_id uuid)
returns void as $$
declare
  v_total numeric(12,2);
  v_account uuid;
begin
  select account_id into v_account from public.billing_cycles where id = p_cycle_id;

  select coalesce(sum(amount), 0) into v_total
  from public.transactions
  where billing_cycle_id = p_cycle_id;

  update public.billing_cycles
  set status = 'closed',
      statement_balance = v_total
  where id = p_cycle_id;
end;
$$ language plpgsql;

-- ============================================================
-- 7. Auto-close cycles whose end date has passed (call periodically)
-- ============================================================
create or replace function public.auto_close_expired_cycles()
returns int as $$
declare
  v_count int := 0;
  r record;
begin
  for r in
    select id from public.billing_cycles
    where status = 'open' and cycle_end < current_date
  loop
    perform public.close_billing_cycle(r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$ language plpgsql;

-- ============================================================
-- 8. Backfill: assign cycles to existing CC transactions
-- ============================================================
do $$
declare
  r record;
begin
  for r in
    select t.id, t.account_id, t.date
    from public.transactions t
    join public.accounts a on a.id = t.account_id
    where a.type = 'credit_card' and t.billing_cycle_id is null
  loop
    update public.transactions
    set billing_cycle_id = public.ensure_billing_cycle(r.account_id, r.date)
    where id = r.id;
  end loop;
end $$;

-- Run auto-close on existing data
select public.auto_close_expired_cycles();

-- ============================================================
-- 9. RLS for billing cycles
-- ============================================================
alter table public.billing_cycles enable row level security;

create policy "Authenticated full access" on public.billing_cycles
  for all using (auth.role() = 'authenticated');
