-- ============================================================
-- CTY Ministries - likes and comments for signed-in members
-- Run this in Supabase SQL Editor
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

drop policy if exists "Anyone can read likes" on public.post_likes;
drop policy if exists "Signed-in users can like" on public.post_likes;
drop policy if exists "Users can remove own likes" on public.post_likes;
drop policy if exists "Admins can delete any like" on public.post_likes;

create policy "Anyone can read likes"
on public.post_likes for select
using (true);

create policy "Signed-in users can like"
on public.post_likes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can remove own likes"
on public.post_likes for delete
to authenticated
using (auth.uid() = user_id);

create policy "Admins can delete any like"
on public.post_likes for delete
to authenticated
using (public.is_admin());

drop policy if exists "Anyone can read comments" on public.post_comments;
drop policy if exists "Signed-in users can comment" on public.post_comments;
drop policy if exists "Users can delete own comments" on public.post_comments;
drop policy if exists "Admins can delete any comment" on public.post_comments;

create policy "Anyone can read comments"
on public.post_comments for select
using (true);

create policy "Signed-in users can comment"
on public.post_comments for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete own comments"
on public.post_comments for delete
to authenticated
using (auth.uid() = user_id);

create policy "Admins can delete any comment"
on public.post_comments for delete
to authenticated
using (public.is_admin());

create index if not exists idx_post_likes_post_id on public.post_likes(post_id);
create index if not exists idx_post_comments_post_id on public.post_comments(post_id);
create index if not exists idx_post_comments_created_at on public.post_comments(created_at desc);
