-- CTY TESTIMONIES: SIMPLE MODERATION SETUP
-- Run this in Supabase SQL Editor.

create table if not exists public.testimonies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location text,
  theme text not null,
  description text not null,
  photo_url text,
  status text not null default 'pending'
    check (status in ('pending', 'published', 'rejected')),
  is_deleted boolean not null default false,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.testimonies enable row level security;

-- IMPORTANT:
-- Remove/adjust old policies on this table if you already created them.
-- Public visitors can ONLY read published stories.
create policy "Anyone can read published testimonies"
on public.testimonies
for select
using (status = 'published' and is_deleted = false);

-- Signed-in members can submit their own testimony.
create policy "Members can submit testimonies"
on public.testimonies
for insert
to authenticated
with check (
  auth.uid() = user_id
  and status = 'pending'
  and is_deleted = false
);

-- Members can see their own submissions if you later build a "My submissions" page.
create policy "Members can read their own submissions"
on public.testimonies
for select
to authenticated
using (auth.uid() = user_id);

-- ADMIN POLICY:
-- This assumes profiles.is_admin is already present.
create policy "Admins can manage testimonies"
on public.testimonies
for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

-- Storage bucket.
insert into storage.buckets (id, name, public)
values ('testimonies', 'testimonies', true)
on conflict (id) do nothing;

-- Members can upload testimony photos into their own folder.
create policy "Members upload testimony photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'testimonies'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can delete/manage testimony photos.
create policy "Admins manage testimony photos"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'testimonies'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
)
with check (
  bucket_id = 'testimonies'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);
