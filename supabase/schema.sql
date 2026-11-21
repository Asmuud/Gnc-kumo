-- GNC Kumo initial database schema.
-- Run this in Supabase SQL Editor using the project owner account.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null,
  address text not null,
  photo_url text,
  favourite_song text not null,
  date_of_birth date not null,
  marital_status text not null check (marital_status in ('Single','Married','Divorced','Widowed','Prefer not to say')),
  education_level text not null,
  role text not null default 'member' check (role in ('member','admin','super_admin')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  category text,
  lyrics text,
  audio_url text,
  midi_url text,
  cover_url text,
  published boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_approved_member()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and approval_status = 'approved')
$$;

alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.announcements enable row level security;

-- Users can read/update their own profile. Admins can manage all profiles.
drop policy if exists "profile read own or admin" on public.profiles;
create policy "profile read own or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.current_user_role() in ('admin','super_admin'));

drop policy if exists "profile insert own member" on public.profiles;
create policy "profile insert own member" on public.profiles for insert to authenticated
with check (id = auth.uid() and role = 'member' and approval_status = 'pending');

drop policy if exists "profile update own safe fields" on public.profiles;
create policy "profile update own safe fields" on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()) and approval_status = (select p.approval_status from public.profiles p where p.id = auth.uid()));

drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles for all to authenticated
using (public.current_user_role() in ('admin','super_admin'))
with check (public.current_user_role() in ('admin','super_admin'));

-- Published music is visible only to approved members. Admins can manage music.
drop policy if exists "approved members read published songs" on public.songs;
create policy "approved members read published songs" on public.songs for select to authenticated
using ((published = true and public.is_approved_member()) or public.current_user_role() in ('admin','super_admin'));
drop policy if exists "admins manage songs" on public.songs;
create policy "admins manage songs" on public.songs for all to authenticated
using (public.current_user_role() in ('admin','super_admin'))
with check (public.current_user_role() in ('admin','super_admin'));

drop policy if exists "approved members read announcements" on public.announcements;
create policy "approved members read announcements" on public.announcements for select to authenticated
using ((published = true and public.is_approved_member()) or public.current_user_role() in ('admin','super_admin'));
drop policy if exists "admins manage announcements" on public.announcements;
create policy "admins manage announcements" on public.announcements for all to authenticated
using (public.current_user_role() in ('admin','super_admin'))
with check (public.current_user_role() in ('admin','super_admin'));

-- Create these three private/public buckets in Storage UI:
-- profile-photos: private, max 5MB, image MIME types only.
-- song-covers: public, image MIME types only.
-- song-audio: public, audio MIME types only (e.g. audio/mpeg, audio/mp4, audio/ogg, audio/wav, audio/midi).
-- song-midi: private, application/octet-stream and audio/midi.
-- Add storage policies after confirming your desired download permissions.
