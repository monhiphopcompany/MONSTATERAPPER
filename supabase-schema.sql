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

-- Page settings for site-wide CMS
create table if not exists public.page_settings (
  id uuid primary key default gen_random_uuid(),
  section text not null unique,
  title text not null default '',
  subtitle text not null default '',
  description text not null default '',
  image_url text not null default '',
  button_text text not null default '',
  button_link text not null default '',
  data_json jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists page_settings_section_idx on public.page_settings(section);

drop trigger if exists page_settings_set_updated_at on public.page_settings;
create trigger page_settings_set_updated_at
before update on public.page_settings
for each row execute function public.set_updated_at();

-- Image storage metadata table
create table if not exists public.uploaded_images (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  storage_path text not null,
  public_url text not null,
  file_size integer not null,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists uploaded_images_uploaded_by_idx on public.uploaded_images(uploaded_by);
create index if not exists uploaded_images_created_at_idx on public.uploaded_images(created_at desc);

-- Only users listed here are allowed to manage content.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.content enable row level security;
alter table public.page_settings enable row level security;
alter table public.uploaded_images enable row level security;
alter table public.admin_users enable row level security;

-- Public website can read published content and settings
drop policy if exists "Public can read content" on public.content;
create policy "Public can read content"
on public.content for select
to anon, authenticated
using (true);

drop policy if exists "Public can read page settings" on public.page_settings;
create policy "Public can read page settings"
on public.page_settings for select
to anon, authenticated
using (true);

drop policy if exists "Public can read uploaded images" on public.uploaded_images;
create policy "Public can read uploaded images"
on public.uploaded_images for select
to anon, authenticated
using (true);

-- Admins can create, edit, and delete content
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

-- Admins can manage page settings
drop policy if exists "Admins can manage page settings" on public.page_settings;
create policy "Admins can manage page settings"
on public.page_settings for all
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Admins can manage uploaded images
drop policy if exists "Admins can manage uploaded images" on public.uploaded_images;
create policy "Admins can manage uploaded images"
on public.uploaded_images for all
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Do not expose the admin_users table to the browser
drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

-- Realtime: enable tables so open public pages can refresh automatically after an Admin change
alter table public.content replica identity full;
alter table public.page_settings replica identity full;
alter table public.uploaded_images replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.content;
  alter publication supabase_realtime add table public.page_settings;
  alter publication supabase_realtime add table public.uploaded_images;
exception
  when duplicate_object then null;
end $$;

-- Initialize default page settings
insert into public.page_settings (section, title, subtitle, description) values
  ('hero', 'MON STATE RAPPERS', 'By Mon HipHop', 'SUPPORTING ARTISTS. BUILDING CULTURE. ONE VOICE. ONE COMMUNITY.'),
  ('about', 'MON HIPHOP', 'ABOUT US', 'Mon HipHop is an independent platform dedicated to Mon State rappers, music, creativity, and cultural expression. We provide a space for artists to share their voices, their culture, and their stories.'),
  ('contact', 'CONTACT', 'GET IN TOUCH', 'Connect with MON HIPHOP and join our community.'),
  ('social', 'SOCIAL LINKS', '', '')
on conflict(section) do nothing;

-- After creating your Admin user in Authentication -> Users, run this once:
-- insert into public.admin_users (user_id) values ('PASTE_AUTH_USER_UUID_HERE');
