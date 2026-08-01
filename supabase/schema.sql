-- DollarAndGold — Supabase schema
--
-- Run this in the Supabase SQL editor (or via `supabase db push`) after
-- creating a project. The app works without it — see "demo mode" in the
-- README — but signing in requires these objects to exist.

create extension if not exists pgcrypto;

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
  -- Gates /admin. Nobody starts as an admin — see "Bootstrapping the first
  -- admin" below.
  is_admin    boolean not null default false,
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

-- ---------------------------------------------------------------------------
-- Admin access.
--
-- `is_admin()` is security definer so the RLS policies below can consult it
-- without recursing back into a `profiles` select (which RLS would otherwise
-- block for a non-admin checking their own flag).
-- ---------------------------------------------------------------------------

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles"
  on public.profiles for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins update all profiles" on public.profiles;
create policy "admins update all profiles"
  on public.profiles for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- The self-writable policy above lets a user update their own row, and RLS is
-- row-level, not column-level — without this trigger a signed-in user could
-- set their own `plan` or `is_admin` directly. `auth.uid() is null` covers a
-- service-role write (e.g. a future payment webhook), which has no session
-- and bypasses RLS entirely; this trigger still lets it through.
create or replace function public.protect_privileged_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    new.is_admin := old.is_admin;
    new.plan := old.plan;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_fields on public.profiles;
create trigger profiles_protect_privileged_fields
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_fields();

-- Bootstrapping the first admin: no one can grant `is_admin` through the app
-- (the admin dashboard needs an admin to already exist), so run this once in
-- the Supabase SQL editor after signing up:
--
--   update public.profiles set is_admin = true where email = 'you@example.com';

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

-- ---------------------------------------------------------------------------
-- News articles: admin-authored replacement for the editorial sample feed.
--
-- `getNewsProvider()` (src/lib/news/provider.ts) prefers these rows and falls
-- back to the bundled sample set wherever this table has nothing published —
-- the same per-symbol fallback shape `providers/composite.ts` uses for market
-- data. An unpublished row is a draft: visible to admins, invisible to
-- everyone else.
-- ---------------------------------------------------------------------------

create table if not exists public.news_articles (
  id                uuid primary key default gen_random_uuid(),
  headline          text not null,
  source            text not null,
  category          text not null,
  symbols           text[] not null default '{}',
  summary           text not null,
  why_it_matters    text not null,
  impact_direction  text not null,
  impact_magnitude  text not null,
  impact_note       text not null,
  url               text,
  published         boolean not null default true,
  published_at      timestamptz not null default now(),
  created_by        uuid references auth.users on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.news_articles enable row level security;

drop policy if exists "news articles are publicly readable" on public.news_articles;
create policy "news articles are publicly readable"
  on public.news_articles for select
  using (published = true or public.is_admin(auth.uid()));

drop policy if exists "admins manage news articles" on public.news_articles;
create policy "admins manage news articles"
  on public.news_articles for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create index if not exists news_articles_published_at_idx
  on public.news_articles (published_at desc);

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

drop trigger if exists news_articles_touch_updated_at on public.news_articles;
create trigger news_articles_touch_updated_at
  before update on public.news_articles
  for each row execute function public.touch_updated_at();
