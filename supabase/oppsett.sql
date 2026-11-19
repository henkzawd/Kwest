-- Kwest: databaseoppsett for Supabase.
-- Lim inn HELE denne filen i Supabase → SQL Editor → New query, og trykk «Run».
-- Trygt å kjøre flere ganger.

-- Lærere (koblet til innloggingskontoene)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  is_admin boolean not null default false,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Kwester
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner uuid references public.profiles(id) on delete set null default auth.uid(),
  title text not null default '',
  description text not null default '',
  data jsonb not null default '{}'::jsonb,
  question_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quizzes_owner_idx on public.quizzes(owner);

-- Hjelpefunksjoner for tilgangsregler
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select approved from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin and approved from public.profiles where id = auth.uid()), false);
$$;

-- Ny konto → ny lærerprofil. Den aller første kontoen blir administrator og godkjent automatisk.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, email, name, is_admin, approved)
  values (new.id, new.email,
          coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
          first_user, first_user);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tilgangsregler
alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_approved());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "quizzes_select" on public.quizzes;
create policy "quizzes_select" on public.quizzes for select to authenticated
  using (public.is_approved());

drop policy if exists "quizzes_insert" on public.quizzes;
create policy "quizzes_insert" on public.quizzes for insert to authenticated
  with check (public.is_approved() and owner = auth.uid());

drop policy if exists "quizzes_update" on public.quizzes;
create policy "quizzes_update" on public.quizzes for update to authenticated
  using (public.is_approved() and (owner = auth.uid() or public.is_admin()))
  with check (public.is_approved() and (owner = auth.uid() or public.is_admin()));

drop policy if exists "quizzes_delete" on public.quizzes;
create policy "quizzes_delete" on public.quizzes for delete to authenticated
  using (public.is_approved() and (owner = auth.uid() or public.is_admin()));

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.quizzes to authenticated;

-- Fillager for bilder og lyd (offentlig lesbart, bare godkjente lærere kan laste opp).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 20971520, array['image/*', 'audio/*'])
on conflict (id) do update set public = true, file_size_limit = 20971520, allowed_mime_types = array['image/*', 'audio/*'];

drop policy if exists "media_upload" on storage.objects;
create policy "media_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_approved());

-- Tilbakemeldinger: alle (også elever) kan sende, bare administratorer kan lese.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null check (char_length(message) between 1 and 2000),
  name text check (name is null or char_length(name) <= 80),
  email text check (email is null or char_length(email) <= 200),
  page text check (page is null or char_length(page) <= 40),
  user_id uuid default auth.uid(),
  handled boolean not null default false
);
alter table public.feedback enable row level security;

drop policy if exists "feedback_insert" on public.feedback;
create policy "feedback_insert" on public.feedback for insert to anon, authenticated
  with check (handled = false);

drop policy if exists "feedback_admin_select" on public.feedback;
create policy "feedback_admin_select" on public.feedback for select to authenticated using (public.is_admin());

drop policy if exists "feedback_admin_update" on public.feedback;
create policy "feedback_admin_update" on public.feedback for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "feedback_admin_delete" on public.feedback;
create policy "feedback_admin_delete" on public.feedback for delete to authenticated using (public.is_admin());

grant insert on public.feedback to anon, authenticated;
grant select, update, delete on public.feedback to authenticated;
