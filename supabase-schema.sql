-- MON HIPHOP: Supabase database setup
-- Run this in Supabase Dashboard -> SQL Editor.

create table if not exists public.content (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('artist', 'release')),
  name text not null,
  description text not null default '',
  drive_link text not null default '',
  image text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_type_idx on public.content(type);
create index if not exists content_created_at_idx on public.content(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists content_set_updated_at on public.content;
create trigger content_set_updated_at
before update on public.content
for each row execute function public.set_updated_at();

-- Only users listed here are allowed to manage content.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.content enable row level security;
alter table public.admin_users enable row level security;

-- Public website can read published content.
drop policy if exists "Public can read content" on public.content;
create policy "Public can read content"
on public.content for select
to anon, authenticated
using (true);

-- Admins can create, edit, and delete content.
drop policy if exists "Admins can insert content" on public.content;
create policy "Admins can insert content"
on public.content for insert
to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can update content" on public.content;
create policy "Admins can update content"
on public.content for update
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can delete content" on public.content;
create policy "Admins can delete content"
on public.content for delete
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Do not expose the admin_users table to the browser.
drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

-- Realtime: enable table so open public pages can refresh automatically after an Admin change.
alter table public.content replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.content;
exception
  when duplicate_object then null;
end $$;

-- After creating your Admin user in Authentication -> Users, run this once:
-- insert into public.admin_users (user_id) values ('PASTE_AUTH_USER_UUID_HERE');
