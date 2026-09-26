-- ============================================================
-- CTY Ministries — consolidated admin permissions
-- Safe to re-run: drops old policies first, then recreates them.
-- Run this in Supabase → SQL Editor
-- ============================================================

-- Profile roles must only be assigned through the trusted SQL Editor/service role.
-- A browser client may update its own profile, but must never promote itself.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      if new.is_admin is true or new.role = 'admin' then
        raise exception 'Profile privileges cannot be assigned by a client';
      end if;
    elsif new.is_admin is distinct from old.is_admin or new.role is distinct from old.role then
      raise exception 'Profile privileges cannot be changed by a client';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
before insert or update on public.profiles
for each row execute function public.protect_profile_privileges();

-- ---------- helper: is the current user an admin? ----------
-- Using a function avoids repeating the same subquery in every policy.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_admin = true
  );
$$;

-- ---------- POSTS ----------
alter table public.posts enable row level security;
drop policy if exists "Anyone can view posts" on public.posts;
drop policy if exists "Only admins can manage posts" on public.posts;
drop policy if exists "Only admins can insert posts" on public.posts;
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
alter table public.events enable row level security;
drop policy if exists "Anyone can view events" on public.events;
drop policy if exists "Admins can view all events" on public.events;
drop policy if exists "Only admins can manage events" on public.events;
drop policy if exists "Only admins can insert events" on public.events;
drop policy if exists "Only admins can update events" on public.events;
drop policy if exists "Only admins can delete events" on public.events;

create policy "Anyone can view events"
on public.events for select
using (status = 'published' and is_deleted = false);

create policy "Admins can view all events"
on public.events for select to authenticated
using (public.is_admin());

create policy "Only admins can insert events"
on public.events for insert
with check (public.is_admin());

create policy "Only admins can update events"
on public.events for update
using (public.is_admin());

create policy "Only admins can delete events"
on public.events for delete
using (public.is_admin());

-- ---------- EVENT RSVPS ----------
alter table public.event_rsvps enable row level security;
drop policy if exists "Members can view own RSVPs" on public.event_rsvps;
drop policy if exists "Members can register for events" on public.event_rsvps;
drop policy if exists "Admins can manage RSVPs" on public.event_rsvps;

create policy "Members can view own RSVPs"
on public.event_rsvps for select to authenticated
using (user_id = auth.uid());

create policy "Members can register for events"
on public.event_rsvps for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.events
    where id = event_id and status = 'published' and is_deleted = false
  )
);

create policy "Admins can manage RSVPs"
on public.event_rsvps for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create unique index if not exists event_rsvps_one_per_user_event
on public.event_rsvps (event_id, user_id);

create or replace function public.update_event_rsvp_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id public.event_rsvps.event_id%type;
begin
  if tg_op = 'INSERT' then
    target_event_id := new.event_id;
  else
    target_event_id := old.event_id;
  end if;

  update public.events
  set rsvp_count = (select count(*) from public.event_rsvps where event_id = target_event_id)
  where id = target_event_id;
  if tg_op = 'INSERT' then
    return new;
  end if;
  return old;
end;
$$;

drop trigger if exists update_event_rsvp_count on public.event_rsvps;
create trigger update_event_rsvp_count
after insert or delete on public.event_rsvps
for each row execute function public.update_event_rsvp_count();

-- ---------- LEADERS ----------
alter table public.leaders enable row level security;
drop policy if exists "Anyone can view published leaders" on public.leaders;
drop policy if exists "Only admins can manage leaders" on public.leaders;

create policy "Anyone can view published leaders"
on public.leaders for select
using (status = 'published' and is_deleted = false);

create policy "Only admins can manage leaders"
on public.leaders for all to authenticated
using (public.is_admin())
with check (public.is_admin());

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

drop policy if exists "Public can view leader photos" on storage.objects;
drop policy if exists "Only admins can upload leader photos" on storage.objects;
drop policy if exists "Only admins can delete leader photos" on storage.objects;

create policy "Public can view leader photos"
on storage.objects for select
using (bucket_id = 'leaders');

create policy "Only admins can upload leader photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'leaders' and public.is_admin());

create policy "Only admins can delete leader photos"
on storage.objects for delete to authenticated
using (bucket_id = 'leaders' and public.is_admin());

-- ---------- Sanity check ----------
-- Run this while signed in (via SQL Editor "Run as" or from your app)
-- to confirm your account is correctly detected as admin:
-- select public.is_admin();