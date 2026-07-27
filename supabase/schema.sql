-- DollarAndGold — Supabase schema
--
-- Run this in the Supabase SQL editor (or via `supabase db push`) after
-- creating a project. The app works without it — see "demo mode" in the
-- README — but signing in requires these objects to exist.

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, created automatically on sign-up.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  full_name   text,
  -- 'free' | 'pro' | 'enterprise'. Billing is out of scope for the MVP; this
  -- column is the seam a payment provider would write to.
  plan        text not null default 'free',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are self-readable" on public.profiles;
create policy "profiles are self-readable"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles are self-writable" on public.profiles;
create policy "profiles are self-writable"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Populate a profile whenever a new auth user appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Workspaces: watchlist, notes, journal and recent analyses.
--
-- Stored as a single JSONB document per user rather than four tables. The
-- workspace is small, always read and written as a whole, and never queried
-- across users — so one row keeps saves atomic (a watchlist edit cannot
-- half-commit against a journal edit) and costs the client one round trip
-- instead of four. Split it out if you ever need to query inside it.
-- ---------------------------------------------------------------------------

create table if not exists public.workspaces (
  user_id     uuid primary key references auth.users on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.workspaces enable row level security;

drop policy if exists "workspaces are self-readable" on public.workspaces;
create policy "workspaces are self-readable"
  on public.workspaces for select
  using (auth.uid() = user_id);

drop policy if exists "workspaces are self-insertable" on public.workspaces;
create policy "workspaces are self-insertable"
  on public.workspaces for insert
  with check (auth.uid() = user_id);

drop policy if exists "workspaces are self-updatable" on public.workspaces;
create policy "workspaces are self-updatable"
  on public.workspaces for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workspaces are self-deletable" on public.workspaces;
create policy "workspaces are self-deletable"
  on public.workspaces for delete
  using (auth.uid() = user_id);

-- Keep updated_at honest regardless of what the client sends.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspaces_touch_updated_at on public.workspaces;
create trigger workspaces_touch_updated_at
  before update on public.workspaces
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
