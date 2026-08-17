-- ============================================================
-- CTY Ministries — consolidated admin permissions
-- Safe to re-run: drops old policies first, then recreates them.
-- Run this in Supabase → SQL Editor
-- ============================================================

-- ---------- helper: is the current user an admin? ----------
-- Using a function avoids repeating the same subquery in every policy.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- POSTS ----------
drop policy if exists "Anyone can view posts" on public.posts;
drop policy if exists "Only admins can manage posts" on public.posts;
drop policy if exists "Only admins can update posts" on public.posts;
drop policy if exists "Only admins can delete posts" on public.posts;

create policy "Anyone can view posts"
on public.posts for select
using (true);

create policy "Only admins can insert posts"
on public.posts for insert
with check (public.is_admin());

create policy "Only admins can update posts"
on public.posts for update
using (public.is_admin());

create policy "Only admins can delete posts"
on public.posts for delete
using (public.is_admin());

-- ---------- EVENTS ----------
drop policy if exists "Anyone can view events" on public.events;
drop policy if exists "Only admins can manage events" on public.events;
drop policy if exists "Only admins can update events" on public.events;
drop policy if exists "Only admins can delete events" on public.events;

create policy "Anyone can view events"
on public.events for select
using (true);

create policy "Only admins can insert events"
on public.events for insert
with check (public.is_admin());

create policy "Only admins can update events"
on public.events for update
using (public.is_admin());

create policy "Only admins can delete events"
on public.events for delete
using (public.is_admin());

-- ---------- STORAGE (photos/videos in the "media" bucket) ----------
drop policy if exists "Public can view media" on storage.objects;
drop policy if exists "Only admins can upload media" on storage.objects;
drop policy if exists "Only admins can delete media" on storage.objects;

create policy "Public can view media"
on storage.objects for select
using (bucket_id = 'media');

create policy "Only admins can upload media"
on storage.objects for insert
with check (bucket_id = 'media' and public.is_admin());

create policy "Only admins can delete media"
on storage.objects for delete
using (bucket_id = 'media' and public.is_admin());

-- ---------- Sanity check ----------
-- Run this while signed in (via SQL Editor "Run as" or from your app)
-- to confirm your account is correctly detected as admin:
-- select public.is_admin();