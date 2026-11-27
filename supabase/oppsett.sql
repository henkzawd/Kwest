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

-- Private kwest: bare den som laget kwestet kan se det.
alter table public.quizzes add column if not exists is_private boolean not null default false;
drop policy if exists "quizzes_select" on public.quizzes;
create policy "quizzes_select" on public.quizzes for select to authenticated
  using (public.is_approved() and (not is_private or owner = auth.uid()));

-- Hjemmelekse: elevene tar et kwest i sitt eget tempo via en lenke.
-- Ingen navn lagres – bare anonyme svar (riktig/galt og svaret) per spørsmål.
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  quiz_id uuid references public.quizzes(id) on delete set null,
  owner uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null default '',
  data jsonb not null default '{}'::jsonb,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists assignments_quiz_idx on public.assignments(quiz_id);

create table if not exists public.assignment_results (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  created_at timestamptz not null default now(),
  score integer not null default 0,
  answers jsonb not null default '[]'::jsonb
);
create index if not exists assignment_results_idx on public.assignment_results(assignment_id);

alter table public.assignments enable row level security;
alter table public.assignment_results enable row level security;

drop policy if exists "assignments_owner" on public.assignments;
create policy "assignments_owner" on public.assignments for all to authenticated
  using (public.is_approved() and owner = auth.uid())
  with check (public.is_approved() and owner = auth.uid());

drop policy if exists "assignment_results_owner" on public.assignment_results;
create policy "assignment_results_owner" on public.assignment_results for select to authenticated
  using (exists (select 1 from public.assignments a where a.id = assignment_id and a.owner = auth.uid()));

grant select, insert, update, delete on public.assignments to authenticated;
grant select on public.assignment_results to authenticated;

-- Elevene (uten innlogging) kan bare hente en lekse og sende inn svar – via disse to funksjonene.
create or replace function public.get_assignment(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('title', a.title, 'data', a.data, 'open', a.is_open)
  from public.assignments a where a.code = p_code;
$$;

create or replace function public.submit_assignment(p_code text, p_score integer, p_answers jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare a_id uuid;
begin
  select id into a_id from public.assignments where code = p_code and is_open;
  if a_id is null then return false; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then return false; end if;
  if jsonb_array_length(p_answers) > 200 or octet_length(p_answers::text) > 30000 then return false; end if;
  insert into public.assignment_results (assignment_id, score, answers)
  values (a_id, greatest(0, least(coalesce(p_score, 0), 1000000)), p_answers);
  return true;
end;
$$;

revoke all on function public.get_assignment(text) from public;
revoke all on function public.submit_assignment(text, integer, jsonb) from public;
grant execute on function public.get_assignment(text) to anon, authenticated;
grant execute on function public.submit_assignment(text, integer, jsonb) to anon, authenticated;

-- Oppsummering etter hvert spill: bare samlede, anonyme tall per spørsmål.
-- Ingen navn, ingen poeng per elev og ingen kobling mellom svar og person.
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  owner uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  title text not null default '',
  played_at timestamptz not null default now(),
  players integer not null default 0 check (players between 0 and 10000),
  summary jsonb not null default '{}'::jsonb check (octet_length(summary::text) < 300000)
);
create index if not exists sessions_quiz_idx on public.sessions(quiz_id);
create index if not exists sessions_owner_idx on public.sessions(owner);
alter table public.sessions enable row level security;

drop policy if exists "sessions_owner_select" on public.sessions;
create policy "sessions_owner_select" on public.sessions for select to authenticated
  using (public.is_approved() and owner = auth.uid());
drop policy if exists "sessions_owner_insert" on public.sessions;
create policy "sessions_owner_insert" on public.sessions for insert to authenticated
  with check (public.is_approved() and owner = auth.uid());
drop policy if exists "sessions_owner_delete" on public.sessions;
create policy "sessions_owner_delete" on public.sessions for delete to authenticated
  using (public.is_approved() and owner = auth.uid());

grant select, insert, delete on public.sessions to authenticated;

-- Automatisk opprydding av personopplysninger:
-- navn og e-post i tilbakemeldinger slettes etter 180 dager (selve meldingen beholdes).
create or replace function public.cleanup_personal_data() returns void
language sql security definer set search_path = '' as $$
  update public.feedback set name = null, email = null
  where (name is not null or email is not null) and created_at < now() - interval '180 days';
$$;
revoke all on function public.cleanup_personal_data() from public;
grant execute on function public.cleanup_personal_data() to authenticated;

-- Kjører oppryddingen hver natt hvis Supabase sin tidsplanlegger (pg_cron) er tilgjengelig.
-- Ellers kjøres den hver gang en lærer åpner Kwest Studio.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('kwest-opprydding', '17 3 * * *', 'select public.cleanup_personal_data()');
exception when others then
  raise notice 'Nattlig opprydding ikke slått på (%). Den kjøres i stedet når lærere åpner Kwest Studio.', sqlerrm;
end $$;
