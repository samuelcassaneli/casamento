-- Wedding photo upload system
create extension if not exists pgcrypto;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  couple_names text not null,
  wedding_date date,
  drive_folder_id text,            -- optional override of DRIVE_ROOT_FOLDER_ID
  active boolean not null default true,
  upload_deadline timestamptz,
  created_at timestamptz not null default now()
);

create table public.guest_folders (
  event_id uuid not null references public.events(id) on delete cascade,
  guest_key text not null,         -- normalized guest name
  drive_folder_id text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, guest_key)
);

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null check (char_length(guest_name) between 1 and 80),
  device_id text not null check (char_length(device_id) between 8 and 64),
  filename text not null,
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0),
  drive_file_id text,
  status text not null default 'pending' check (status in ('pending','done','failed')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index uploads_event_created_idx on public.uploads (event_id, created_at desc);
create index uploads_device_created_idx on public.uploads (device_id, created_at);

create table public.admins (
  email text primary key
);

alter table public.events enable row level security;
alter table public.guest_folders enable row level security;
alter table public.uploads enable row level security;
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(auth.jwt() ->> 'email'));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Guests read only the public event header (name/date) for the landing page
create policy events_public_read on public.events for select to anon, authenticated using (active);
create policy events_admin_read on public.events for select to authenticated using (public.is_admin());
create policy uploads_admin_read on public.uploads for select to authenticated using (public.is_admin());
create policy uploads_admin_update on public.uploads for update to authenticated using (public.is_admin());

-- Guests only need couple_names/date/slug: hide the rest from anon
revoke select on public.events from anon;
grant select (slug, couple_names, wedding_date, active, upload_deadline) on public.events to anon;
