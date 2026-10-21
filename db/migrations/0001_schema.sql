-- Building Expense Management — core schema
-- Money: integer agorot (bigint). Calendar dates: DATE. Nothing posted is ever deleted;
-- mistakes are fixed with voids and adjustments.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- users
create table app_users (
  id uuid primary key,                       -- = auth.users.id
  email text not null unique,
  full_name text not null default '',
  role text not null default 'admin' check (role in ('admin', 'treasurer', 'viewer')),
  active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- settings (single row)
create table settings (
  id int primary key default 1 check (id = 1),
  building_name text not null default '',
  building_address text not null default '',
  currency text not null default 'ILS',
  timezone text not null default 'Asia/Hebron',
  opening_balance bigint not null default 0,
  opening_date date,                          -- cash balance is "as of the start of" this date
  due_day int not null default 10 check (due_day between 1 and 28),
  receipt_prefix text not null default 'R' check (receipt_prefix ~ '^[A-Za-z]{1,6}$'),
  receipt_footer text not null default '',
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1);

-- ---------------------------------------------------------------- apartments & owners
create table apartments (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  floor int,
  billing_start_month date not null check (extract(day from billing_start_month) = 1),
  notes text not null default '',
  archived_at date,
  created_at timestamptz not null default now()
);
create unique index apartments_number_uq on apartments (lower(number));

create table owners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,                                  -- E.164, e.g. +970599123456
  email text,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table apartment_owners (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments(id),
  owner_id uuid not null references owners(id),
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create unique index apartment_owners_current_uq on apartment_owners (apartment_id) where end_date is null;

-- ---------------------------------------------------------------- fees (effective-dated)
create table fee_rates (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid references apartments(id),  -- null = building-wide rate
  amount bigint not null check (amount >= 0),
  effective_from date not null check (extract(day from effective_from) = 1),
  note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index fee_rates_building_uq on fee_rates (effective_from) where apartment_id is null;
create unique index fee_rates_apartment_uq on fee_rates (apartment_id, effective_from) where apartment_id is not null;

-- ---------------------------------------------------------------- dues ledger
create table charges (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments(id),
  kind text not null check (kind in ('monthly', 'special', 'opening', 'other')),
  billing_month date not null check (extract(day from billing_month) = 1),
  due_date date not null,
  amount bigint not null check (amount > 0),
  description text not null default '',
  status text not null default 'active' check (status in ('active', 'voided')),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);
-- One monthly charge per apartment+month (also blocks regeneration of a voided month).
-- Partial: special assessments can repeat within a month.
create unique index charges_monthly_uq on charges (apartment_id, billing_month) where kind = 'monthly';
create index charges_apartment_idx on charges (apartment_id, status);
create index charges_month_idx on charges (billing_month);

create table payments (
  id uuid primary key default gen_random_uuid(),
  receipt_no text unique,                     -- null for opening credits (not cash)
  kind text not null default 'payment' check (kind in ('payment', 'opening_credit')),
  apartment_id uuid not null references apartments(id),
  payer_name text not null default '',
  amount bigint not null check (amount > 0),
  payment_date date not null,
  method text not null default 'cash' check (method in ('cash', 'bank_transfer', 'cheque', 'card', 'other')),
  reference text not null default '',
  notes text not null default '',
  status text not null default 'active' check (status in ('active', 'voided')),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid,
  idempotency_key text unique,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index payments_apartment_idx on payments (apartment_id, status);
create index payments_date_idx on payments (payment_date);

-- Links a payment to the charges it settles. Unlinked remainder of a payment = apartment credit.
-- effective_date lets reports compute dues outstanding at any past month-end.
create table allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id),
  charge_id uuid not null references charges(id),
  amount bigint not null check (amount > 0),
  effective_date date not null,
  released_at timestamptz,                    -- set when the charge is voided; money returns to credit
  created_at timestamptz not null default now()
);
create index allocations_payment_idx on allocations (payment_id);
create index allocations_charge_idx on allocations (charge_id);

create table adjustments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references charges(id),
  apartment_id uuid not null references apartments(id),
  kind text not null check (kind in ('waiver', 'discount', 'correction')),
  amount bigint not null check (amount > 0),  -- reduces what the apartment owes
  adj_date date not null,
  reason text not null,
  status text not null default 'active' check (status in ('active', 'voided')),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index adjustments_charge_idx on adjustments (charge_id);
create index adjustments_apartment_idx on adjustments (apartment_id);

-- ---------------------------------------------------------------- cash out
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null default '',
  archived boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references expense_categories(id),
  amount bigint not null check (amount > 0),
  expense_date date not null,
  vendor text not null default '',
  description text not null default '',
  method text not null default 'cash' check (method in ('cash', 'bank_transfer', 'cheque', 'card', 'other')),
  reference text not null default '',
  attachment_path text,
  status text not null default 'active' check (status in ('active', 'voided')),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid,
  idempotency_key text unique,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index expenses_date_idx on expenses (expense_date);
create index expenses_category_idx on expenses (category_id);

-- ---------------------------------------------------------------- support
create table receipt_counters (
  year int primary key,
  last_no int not null default 0
);

create table job_runs (
  id bigserial primary key,
  job text not null,
  month date,
  created_count int not null default 0,
  credit_applied bigint not null default 0,
  triggered_by text not null,
  run_at timestamptz not null default now()
);

-- Append-only audit trail
create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid,
  user_email text,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb
);
create index audit_log_entity_idx on audit_log (entity, entity_id);
create index audit_log_at_idx on audit_log (at desc);

create or replace function audit_log_immutable() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_immutable();

-- Posted money rows are never deleted.
create or replace function forbid_delete() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'records in % cannot be deleted; void them instead', tg_table_name;
end $$;
create trigger charges_no_delete before delete on charges for each row execute function forbid_delete();
create trigger payments_no_delete before delete on payments for each row execute function forbid_delete();
create trigger allocations_no_delete before delete on allocations for each row execute function forbid_delete();
create trigger adjustments_no_delete before delete on adjustments for each row execute function forbid_delete();
create trigger expenses_no_delete before delete on expenses for each row execute function forbid_delete();

-- Money fields on posted rows are immutable (change = void + re-enter).
create or replace function guard_payment_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.amount <> old.amount or new.payment_date <> old.payment_date
     or new.apartment_id <> old.apartment_id or new.kind <> old.kind
     or new.receipt_no is distinct from old.receipt_no then
    raise exception 'payment amount/date/apartment cannot be edited; void and re-enter';
  end if;
  if old.status = 'voided' and new.status = 'active' then
    raise exception 'voided records cannot be reactivated';
  end if;
  return new;
end $$;
create or replace function guard_expense_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.amount <> old.amount or new.expense_date <> old.expense_date then
    raise exception 'expense amount/date cannot be edited; void and re-enter';
  end if;
  if old.status = 'voided' and new.status = 'active' then
    raise exception 'voided records cannot be reactivated';
  end if;
  return new;
end $$;
create or replace function guard_charge_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.amount <> old.amount or new.apartment_id <> old.apartment_id or new.billing_month <> old.billing_month then
    raise exception 'charge amount/month/apartment cannot be edited; void or adjust';
  end if;
  if old.status = 'voided' and new.status = 'active' then
    raise exception 'voided records cannot be reactivated';
  end if;
  return new;
end $$;
create or replace function guard_allocation_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.amount <> old.amount or new.payment_id <> old.payment_id or new.charge_id <> old.charge_id
     or new.effective_date <> old.effective_date or (old.released_at is not null) then
    raise exception 'allocations can only be released';
  end if;
  return new;
end $$;
create trigger payments_money_guard before update on payments for each row execute function guard_payment_update();
create trigger expenses_money_guard before update on expenses for each row execute function guard_expense_update();
create trigger charges_money_guard before update on charges for each row execute function guard_charge_update();
create trigger allocations_guard before update on allocations for each row execute function guard_allocation_update();

-- ---------------------------------------------------------------- views
-- Live (current) state of every charge.
create view charge_balances with (security_invoker = true) as
select
  c.*,
  coalesce(a.paid, 0)::bigint as paid,
  coalesce(j.adjusted, 0)::bigint as adjusted,
  greatest(c.amount - coalesce(a.paid, 0) - coalesce(j.adjusted, 0), 0)::bigint as outstanding
from charges c
left join (
  select al.charge_id, sum(al.amount) as paid
  from allocations al join payments p on p.id = al.payment_id
  where p.status = 'active' and al.released_at is null
  group by al.charge_id
) a on a.charge_id = c.id
left join (
  select charge_id, sum(amount) as adjusted from adjustments where status = 'active' group by charge_id
) j on j.charge_id = c.id;

-- Unallocated money per active payment (apartment credit lives here).
create view payment_balances with (security_invoker = true) as
select
  p.*,
  coalesce(a.allocated, 0)::bigint as allocated,
  (p.amount - coalesce(a.allocated, 0))::bigint as unallocated
from payments p
left join (
  select payment_id, sum(amount) as allocated from allocations where released_at is null group by payment_id
) a on a.payment_id = p.id;

-- Seed default expense categories
insert into expense_categories (name_ar, name_en, sort) values
  ('كهرباء', 'Electricity', 1),
  ('مياه', 'Water', 2),
  ('نظافة', 'Cleaning', 3),
  ('مصعد', 'Elevator', 4),
  ('صيانة', 'Maintenance', 5),
  ('حراسة', 'Security', 6),
  ('أخرى', 'Other', 99);
