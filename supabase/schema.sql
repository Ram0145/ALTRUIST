-- ============================================================
-- ALTRUIST — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PROFILES ──────────────────────────────────────────────────
-- Extends Supabase auth.users
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  name        text,
  email       text unique not null,
  created_at  timestamptz default now()
);

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── HABITS ────────────────────────────────────────────────────
create table public.habits (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  name       text not null,
  icon       text default '◎',
  position   integer default 0,
  active     boolean default true,
  created_at timestamptz default now()
);

-- ── DAILY LOGS ────────────────────────────────────────────────
create table public.daily_logs (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  date          date not null,
  mood          smallint check (mood between 1 and 5),
  energy        smallint check (energy between 1 and 10),
  productivity  smallint check (productivity between 1 and 10),
  calories      integer,
  steps         integer,
  workout_mins  integer,
  screen_hours  numeric(4,1),
  gratitude     text[] default array[]::text[],
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(user_id, date)
);

-- ── HABIT CHECKS ──────────────────────────────────────────────
-- Separate table: one row per habit per day
create table public.habit_checks (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  habit_id   uuid references public.habits(id) on delete cascade not null,
  date       date not null,
  done       boolean default false,
  reason     text,                    -- why skipped (if not done)
  created_at timestamptz default now(),
  unique(user_id, habit_id, date)
);

-- ── PLANS ─────────────────────────────────────────────────────
create type plan_recurrence as enum ('once', 'daily', 'weekly', 'daterange');

create table public.plans (
  id                uuid default uuid_generate_v4() primary key,
  user_id           uuid references public.profiles(id) on delete cascade not null,
  text              text not null,
  recurrence        plan_recurrence default 'once',
  start_date        date not null,
  end_date          date,
  weekdays          integer[] default array[]::integer[],  -- 0=Sun..6=Sat
  done_dates        date[] default array[]::date[],        -- for daily/weekly
  completed_on_date date,                                  -- for daterange
  deleted           boolean default false,
  created_at        timestamptz default now()
);

-- ── SETTINGS ──────────────────────────────────────────────────
create table public.settings (
  user_id            uuid references public.profiles(id) on delete cascade primary key,
  calorie_goal       integer default 2050,
  steps_goal         integer default 8000,
  screen_time_limit  numeric(4,1) default 3.0,
  updated_at         timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- Users can only see/edit their own data

alter table public.profiles     enable row level security;
alter table public.habits        enable row level security;
alter table public.daily_logs    enable row level security;
alter table public.habit_checks  enable row level security;
alter table public.plans         enable row level security;
alter table public.settings      enable row level security;

-- Profiles
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Habits
create policy "Users manage own habits"
  on public.habits for all using (auth.uid() = user_id);

-- Daily logs
create policy "Users manage own logs"
  on public.daily_logs for all using (auth.uid() = user_id);

-- Habit checks
create policy "Users manage own habit checks"
  on public.habit_checks for all using (auth.uid() = user_id);

-- Plans
create policy "Users manage own plans"
  on public.plans for all using (auth.uid() = user_id);

-- Settings
create policy "Users manage own settings"
  on public.settings for all using (auth.uid() = user_id);

-- ── INDEXES ───────────────────────────────────────────────────
create index idx_daily_logs_user_date on public.daily_logs(user_id, date);
create index idx_habit_checks_user_date on public.habit_checks(user_id, date);
create index idx_habit_checks_habit on public.habit_checks(habit_id);
create index idx_plans_user on public.plans(user_id);
create index idx_habits_user on public.habits(user_id);
