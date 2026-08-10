-- ============================================================
-- CTY Ministries — profiles table, auto-create trigger, RLS
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. Table -------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  date_of_birth date,
  bio text,
  role text not null default 'member'
    check (role in ('member', 'leader', 'admin')),
  ministry_group text
    check (ministry_group in ('children', 'teens', 'youth')),
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Auto-create a profile row the moment someone signs up -------
-- Reads the extra fields we pass in supabase.auth.signUp({ options: { data: {...} } })
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, date_of_birth, ministry_group)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    new.raw_user_meta_data->>'ministry_group'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Keep updated_at fresh ----------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- 4. Row Level Security ---------------------------------------------
alter table public.profiles enable row level security;

-- Users can see their own profile
create policy "Users can view own profile"
on public.profiles for select
using (auth.uid() = id);

-- (Optional) Let signed-in users see basic info of other members,
-- e.g. for displaying names on comments/posts. Remove if you'd
-- rather keep profiles fully private.
create policy "Signed-in users can view basic profile info"
on public.profiles for select
using (auth.role() = 'authenticated');

-- Users can update their own profile (but see the role-lock below)
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id);

-- 5. Prevent users from promoting themselves to admin ----------------
create or replace function public.prevent_role_self_escalation()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role then
    if not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    ) then
      new.role := old.role; -- silently ignore the change unless an admin made it
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_role_change
  before update on public.profiles
  for each row execute procedure public.prevent_role_self_escalation();