-- ============================================================================
-- Saloon Booking Bot — Supabase schema
-- Run this entire file in Supabase SQL Editor on a fresh project.
-- ============================================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists btree_gist;

-- ----------------------------------------------------------------------------
-- customers
-- ----------------------------------------------------------------------------
create table if not exists customers (
  id          uuid primary key default uuid_generate_v4(),
  phone       text not null unique,       -- full WhatsApp number, e.g. "whatsapp:+94771234567"
  name        text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- services (haircut, color, etc.)
-- ----------------------------------------------------------------------------
create table if not exists services (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,
  duration_minutes int  not null check (duration_minutes > 0),
  price            numeric(10,2) not null default 0,
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- working_hours — one row per weekday (0 = Sunday ... 6 = Saturday)
-- ----------------------------------------------------------------------------
create table if not exists working_hours (
  weekday    smallint primary key check (weekday between 0 and 6),
  open_time  time,
  close_time time,
  is_closed  boolean not null default false,
  check (is_closed or (open_time is not null and close_time is not null and close_time > open_time))
);

-- ----------------------------------------------------------------------------
-- schedule_exceptions — holidays or special-day overrides
-- ----------------------------------------------------------------------------
create table if not exists schedule_exceptions (
  date        date primary key,
  is_closed   boolean not null default false,
  open_time   time,
  close_time  time,
  note        text,
  check (is_closed or (open_time is not null and close_time is not null and close_time > open_time))
);

-- ----------------------------------------------------------------------------
-- appointments
-- status: pending | confirmed | cancelled | completed
-- Exclusion constraint prevents overlapping non-cancelled bookings.
-- ----------------------------------------------------------------------------
create table if not exists appointments (
  id             uuid primary key default uuid_generate_v4(),
  customer_id    uuid not null references customers(id) on delete cascade,
  service_id     uuid not null references services(id),
  start_at       timestamptz not null,
  end_at         timestamptz not null,
  status         text not null default 'confirmed'
                   check (status in ('pending','confirmed','cancelled','completed')),
  reminder_sent  boolean not null default false,
  created_at     timestamptz not null default now(),
  check (end_at > start_at),
  constraint appointments_no_overlap
    exclude using gist (
      tstzrange(start_at, end_at, '[)') with &&
    ) where (status <> 'cancelled')
);

create index if not exists appointments_start_at_idx on appointments (start_at);
create index if not exists appointments_customer_idx  on appointments (customer_id);
create index if not exists appointments_reminder_idx  on appointments (start_at) where reminder_sent = false and status = 'confirmed';

-- ----------------------------------------------------------------------------
-- conversation_sessions — per-phone WhatsApp conversation state
-- state: idle | awaiting_service | awaiting_date | awaiting_slot
-- context example:
--   { "service_id": "...", "service_name": "Haircut", "duration": 30,
--     "date": "2026-04-15", "candidate_slots": ["2026-04-15T10:00:00+05:30", ...] }
-- ----------------------------------------------------------------------------
create table if not exists conversation_sessions (
  phone       text primary key,
  state       text not null default 'idle'
                check (state in ('idle','awaiting_service','awaiting_date','awaiting_slot')),
  context     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- RPC: get_available_slots
-- Returns available slot start times (timestamptz) for a given date and
-- service duration, stepping by p_step_minutes (default 15).
-- Honours schedule_exceptions over working_hours.
-- ============================================================================
create or replace function get_available_slots(
  p_date                   date,
  p_duration               int,
  p_step_minutes           int default 15,
  p_exclude_appointment_id uuid default null
)
returns table (slot_start timestamptz)
language plpgsql
stable
as $$
declare
  v_open        time;
  v_close       time;
  v_is_closed   boolean;
  v_exc         schedule_exceptions%rowtype;
  v_weekday     smallint;
  v_slot_start  timestamptz;
  v_slot_end    timestamptz;
  v_day_end     timestamptz;
begin
  -- 1. Resolve hours: exception overrides weekday
  select * into v_exc from schedule_exceptions where date = p_date;
  if found then
    v_is_closed := v_exc.is_closed;
    v_open      := v_exc.open_time;
    v_close     := v_exc.close_time;
  else
    v_weekday := extract(dow from p_date)::smallint;
    select wh.open_time, wh.close_time, wh.is_closed
      into v_open, v_close, v_is_closed
      from working_hours wh
      where wh.weekday = v_weekday;
  end if;

  if v_is_closed or v_open is null or v_close is null then
    return;
  end if;

  v_slot_start := (p_date + v_open)::timestamptz;
  v_day_end    := (p_date + v_close)::timestamptz;

  while v_slot_start + make_interval(mins => p_duration) <= v_day_end loop
    v_slot_end := v_slot_start + make_interval(mins => p_duration);

    -- Skip past-time slots (grace: 5 min)
    if v_slot_start >= now() + interval '5 minutes' then
      -- No overlap with any non-cancelled appointment (optionally excluding one)?
      if not exists (
        select 1 from appointments a
        where a.status <> 'cancelled'
          and (p_exclude_appointment_id is null or a.id <> p_exclude_appointment_id)
          and tstzrange(a.start_at, a.end_at, '[)') && tstzrange(v_slot_start, v_slot_end, '[)')
      ) then
        slot_start := v_slot_start;
        return next;
      end if;
    end if;

    v_slot_start := v_slot_start + make_interval(mins => p_step_minutes);
  end loop;
end;
$$;

-- ============================================================================
-- Seed data
-- ============================================================================

-- Working hours: closed Sunday, 09:00-18:00 Mon-Sat
insert into working_hours (weekday, open_time, close_time, is_closed) values
  (0, null,       null,       true),
  (1, '09:00'::time, '18:00'::time, false),
  (2, '09:00'::time, '18:00'::time, false),
  (3, '09:00'::time, '18:00'::time, false),
  (4, '09:00'::time, '18:00'::time, false),
  (5, '09:00'::time, '18:00'::time, false),
  (6, '09:00'::time, '18:00'::time, false)
on conflict (weekday) do nothing;

-- Sample services
insert into services (name, duration_minutes, price, sort_order) values
  ('Haircut',       30, 1500, 1),
  ('Hair Color',    60, 4500, 2),
  ('Beard Trim',    15,  800, 3),
  ('Hair Spa',      45, 3000, 4)
on conflict do nothing;

-- ============================================================================
-- Row Level Security
-- All DB access happens from the Next.js backend via the service role key,
-- which bypasses RLS. Enabling RLS with no policies means the anon/public
-- key (and anyone else) gets zero access. Defense in depth.
-- ============================================================================
alter table customers              enable row level security;
alter table services               enable row level security;
alter table working_hours          enable row level security;
alter table schedule_exceptions    enable row level security;
alter table appointments           enable row level security;
alter table conversation_sessions  enable row level security;
