-- =============================================================================
-- DeadByte — Phase 2 core schema
--
-- Regions, profiles, roles, challenges, evidence metadata, private flag
-- verifiers, submissions, solves and admin audit logs, with RLS on every
-- API-exposed table.
--
-- Security model (see docs/database.md):
--   * `public` is exposed through the Supabase Data API. Every table has RLS
--     enabled and explicit, column-level GRANTs. Supabase's default privileges
--     (ALL to anon/authenticated) are revoked first.
--   * `private` is NOT exposed. It holds roles, flag digests and audit logs.
--   * Privileged operations are SECURITY DEFINER functions named `svc_*` with
--     `search_path = ''` and EXECUTE granted ONLY to `service_role` (the
--     Supabase secret key, used exclusively by server-only Next.js code).
--     Browsers holding the publishable key cannot call them.
--
-- Rollback: supabase/rollbacks/20261031120000_core_schema.down.sql
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
-- anon / authenticated get no USAGE on `private`.

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Regions: the fixed seven-continent mapping (CLAUDE.md §2). Must match
-- src/config/regions.ts (enforced by tests/unit/regions-sql.test.ts).
-- -----------------------------------------------------------------------------

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z]+(-[a-z]+)*$'),
  name text not null,
  forensic_domain text not null,
  sort_order integer not null unique check (sort_order between 1 and 7)
);

insert into public.regions (slug, name, forensic_domain, sort_order) values
  ('antarctica',    'Antarctica',    'Memory Forensics',         1),
  ('north-america', 'North America', 'Disk Forensics',           2),
  ('south-america', 'South America', 'Mobile Forensics',         3),
  ('europe',        'Europe',        'Network Forensics',        4),
  ('africa',        'Africa',        'Browser Forensics',        5),
  ('asia',          'Asia',          'Cloud Forensics',          6),
  ('oceania',       'Oceania',       'File & Artifact Analysis', 7);

-- -----------------------------------------------------------------------------
-- Profiles (public display data only — never email)
-- -----------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  avatar_url text null check (avatar_url is null or (avatar_url ~ '^https://' and length(avatar_url) <= 500)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness without requiring the citext extension.
create unique index profiles_username_lower_key on public.profiles (lower(username));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Roles (private; assigned only by a trusted operator — see docs/database.md)
-- -----------------------------------------------------------------------------

create table private.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'player' check (role in ('admin', 'player')),
  created_at timestamptz not null default now()
);

-- New auth user -> profile + player role. Username comes from sign-up metadata
-- when valid and free; otherwise a neutral generated name the user can change.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested text := new.raw_user_meta_data ->> 'username';
  v_username text;
begin
  if v_requested ~ '^[A-Za-z0-9_]{3,24}$'
     and not exists (select 1 from public.profiles p where lower(p.username) = lower(v_requested)) then
    v_username := v_requested;
  else
    -- 'agent_' + 12 hex chars; retry on the (astronomically unlikely) collision.
    loop
      v_username := 'agent_' || substr(md5(new.id::text || clock_timestamp()::text || random()::text), 1, 12);
      exit when not exists (select 1 from public.profiles p where lower(p.username) = v_username);
    end loop;
  end if;

  insert into public.profiles (user_id, username) values (new.id, v_username);
  insert into private.user_roles (user_id, role) values (new.id, 'player')
    on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Challenges
-- -----------------------------------------------------------------------------

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  region_id uuid not null references public.regions (id),
  title text not null check (length(title) between 1 and 120),
  summary text not null default '' check (length(summary) <= 300),
  description text not null default '' check (length(description) <= 20000),
  category text not null default '' check (length(category) <= 60),
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'insane')),
  points integer not null check (points > 0 and points <= 10000),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- When true, publishing requires at least one active, verified evidence file.
  requires_evidence boolean not null default true,
  -- Clearly labelled sample/testing content (e.g. the first end-to-end case).
  is_sample boolean not null default false,
  published_at timestamptz null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenges_published_has_date check (status <> 'published' or published_at is not null)
);

create index challenges_region_status_idx on public.challenges (region_id, status);
create index challenges_status_published_idx on public.challenges (status, published_at desc);

create trigger challenges_set_updated_at
  before update on public.challenges
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Evidence metadata (bytes live in private R2; Phase 3 fills this table)
-- -----------------------------------------------------------------------------

create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 200 and display_name !~ '[/\\]'),
  -- Server-only. Immutable key: evidence/challenges/<challenge-uuid>/v<n>/<file-uuid>[.ext]
  object_key text not null unique
    check (object_key ~ '^evidence/challenges/[0-9a-f-]{36}/v[0-9]+/[0-9a-f-]{36}(\.[A-Za-z0-9]{1,10}){0,2}$'),
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text null check (mime_type is null or length(mime_type) <= 100),
  upload_status text not null default 'pending' check (upload_status in ('pending', 'verified')),
  verified_at timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index evidence_files_challenge_idx on public.evidence_files (challenge_id);

-- -----------------------------------------------------------------------------
-- Flag verifiers (private). Only HMAC-SHA256(FLAG_HMAC_SECRET, flag) digests.
-- -----------------------------------------------------------------------------

create table private.flag_verifiers (
  challenge_id uuid primary key references public.challenges (id) on delete cascade,
  digest text not null check (digest ~ '^[0-9a-f]{64}$'),
  algorithm text not null default 'hmac-sha256-v1' check (algorithm = 'hmac-sha256-v1'),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Submissions (attempt metadata only — raw attempted flags are NOT stored)
-- -----------------------------------------------------------------------------

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  is_correct boolean not null,
  submitted_at timestamptz not null default now()
);

create index submissions_user_time_idx on public.submissions (user_id, submitted_at desc);
create index submissions_challenge_time_idx on public.submissions (challenge_id, submitted_at desc);

-- -----------------------------------------------------------------------------
-- Solves: the scoring source of truth. One row per (user, challenge), ever.
-- -----------------------------------------------------------------------------

create table public.solves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  points_awarded integer not null check (points_awarded > 0),
  solved_at timestamptz not null default now(),
  constraint solves_user_challenge_key unique (user_id, challenge_id)
);

create index solves_challenge_idx on public.solves (challenge_id);

-- -----------------------------------------------------------------------------
-- Admin audit log (private). Never contains flags, tokens or signed URLs.
-- -----------------------------------------------------------------------------

create table private.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid null references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_logs_time_idx on private.admin_audit_logs (created_at desc);

-- =============================================================================
-- Privileges and Row Level Security
-- =============================================================================

-- Undo Supabase's default "ALL to anon, authenticated" on new public tables.
revoke all on public.regions, public.profiles, public.challenges, public.evidence_files,
  public.submissions, public.solves from anon, authenticated, public;

alter table public.regions enable row level security;
alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.evidence_files enable row level security;
alter table public.submissions enable row level security;
alter table public.solves enable row level security;
alter table private.user_roles enable row level security;
alter table private.flag_verifiers enable row level security;
alter table private.admin_audit_logs enable row level security;

-- regions: public read
grant select on public.regions to anon, authenticated;
create policy regions_select_all on public.regions
  for select to anon, authenticated using (true);

-- profiles: public read of display fields; owner may edit username/avatar only
grant select (user_id, username, avatar_url, created_at) on public.profiles to anon, authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;
create policy profiles_select_all on public.profiles
  for select to anon, authenticated using (true);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- challenges: only published rows; created_by is not exposed
grant select (id, slug, region_id, title, summary, description, category, tags, difficulty, points,
  status, is_sample, published_at, created_at, updated_at) on public.challenges to anon, authenticated;
create policy challenges_select_published on public.challenges
  for select to anon, authenticated using (status = 'published');

-- evidence_files: metadata of active, verified files of published challenges; object_key is NOT granted
grant select (id, challenge_id, display_name, size_bytes, sha256, mime_type, upload_status, is_active, created_at)
  on public.evidence_files to anon, authenticated;
create policy evidence_files_select_published on public.evidence_files
  for select to anon, authenticated
  using (
    is_active
    and upload_status = 'verified'
    and exists (select 1 from public.challenges c where c.id = challenge_id and c.status = 'published')
  );

-- submissions / solves: owner read only; writes only via svc_submit_flag
grant select on public.submissions to authenticated;
create policy submissions_select_own on public.submissions
  for select to authenticated using (user_id = (select auth.uid()));

grant select on public.solves to authenticated;
create policy solves_select_own on public.solves
  for select to authenticated using (user_id = (select auth.uid()));

-- service_role (secret key, server only) keeps full table access and bypasses RLS.
grant all on public.regions, public.profiles, public.challenges, public.evidence_files,
  public.submissions, public.solves to service_role;

-- =============================================================================
-- Privileged functions (service_role only)
-- =============================================================================

-- Submit a flag attempt atomically: rate limit, compare digest, record the
-- attempt and award the first solve exactly once.
--
-- The Next.js server computes p_digest = HMAC-SHA256(FLAG_HMAC_SECRET, flag);
-- the expected digest never leaves the database. Concurrent calls for one user
-- are serialised by an advisory lock, and the unique (user_id, challenge_id)
-- constraint guarantees a single solve regardless.
create or replace function public.svc_submit_flag(
  p_user_id uuid,
  p_challenge_id uuid,
  p_digest text,
  p_max_per_minute integer default 10
)
returns table (result text, points_awarded integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_points integer;
  v_expected text;
  v_recent integer;
  v_oldest timestamptz;
  v_correct boolean;
  v_inserted integer;
begin
  if p_user_id is null or p_challenge_id is null then
    raise exception 'user and challenge are required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('deadbyte:submit:' || p_user_id::text, 0));

  select c.points into v_points
  from public.challenges c
  where c.id = p_challenge_id and c.status = 'published';
  if not found then
    return query select 'not_found'::text, 0, 0;
    return;
  end if;

  select fv.digest into v_expected
  from private.flag_verifiers fv
  where fv.challenge_id = p_challenge_id and fv.algorithm = 'hmac-sha256-v1';
  if not found then
    return query select 'unavailable'::text, 0, 0;
    return;
  end if;

  select count(*), min(s.submitted_at) into v_recent, v_oldest
  from public.submissions s
  where s.user_id = p_user_id and s.submitted_at > now() - interval '60 seconds';
  if v_recent >= greatest(p_max_per_minute, 1) then
    return query select 'rate_limited'::text, 0,
      greatest(1, ceil(extract(epoch from (v_oldest + interval '60 seconds' - now())))::integer);
    return;
  end if;

  v_correct := p_digest is not null and p_digest ~ '^[0-9a-f]{64}$' and p_digest = v_expected;

  insert into public.submissions (user_id, challenge_id, is_correct)
  values (p_user_id, p_challenge_id, v_correct);

  if not v_correct then
    return query select 'incorrect'::text, 0, 0;
    return;
  end if;

  insert into public.solves (user_id, challenge_id, points_awarded)
  values (p_user_id, p_challenge_id, v_points)
  on conflict (user_id, challenge_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    return query select 'solved'::text, v_points, 0;
  else
    return query select 'already_solved'::text, 0, 0;
  end if;
end;
$$;

-- Role lookup for server-side authorization. Unknown users are players.
create or replace function public.svc_get_user_role(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select r.role from private.user_roles r where r.user_id = p_user_id), 'player');
$$;

-- Assign a role. Intended for the operator CLI (scripts/set-role.ts).
create or replace function public.svc_set_user_role(p_user_id uuid, p_role text, p_actor uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_role not in ('admin', 'player') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  insert into private.user_roles (user_id, role) values (p_user_id, p_role)
    on conflict (user_id) do update set role = excluded.role;
  insert into private.admin_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values (p_actor, 'role.set', 'user', p_user_id, jsonb_build_object('role', p_role));
end;
$$;

-- Create (p_id null) or update a challenge's editable fields, optionally
-- replacing its flag digest, and write an audit entry — atomically.
-- Status is NOT editable here: use svc_publish_challenge / svc_archive_challenge.
create or replace function public.svc_admin_save_challenge(
  p_actor uuid,
  p_id uuid,
  p_fields jsonb,
  p_flag_digest text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_region uuid;
begin
  if p_flag_digest is not null and p_flag_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid digest' using errcode = '22023';
  end if;

  select r.id into v_region from public.regions r where r.slug = p_fields ->> 'region';
  if v_region is null then
    raise exception 'unknown region' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.challenges
      (slug, region_id, title, summary, description, category, tags, difficulty, points,
       requires_evidence, is_sample, created_by)
    values (
      p_fields ->> 'slug', v_region, p_fields ->> 'title',
      coalesce(p_fields ->> 'summary', ''), coalesce(p_fields ->> 'description', ''),
      coalesce(p_fields ->> 'category', ''),
      coalesce(array(select jsonb_array_elements_text(p_fields -> 'tags')), '{}'),
      p_fields ->> 'difficulty', (p_fields ->> 'points')::integer,
      coalesce((p_fields ->> 'requiresEvidence')::boolean, true),
      coalesce((p_fields ->> 'isSample')::boolean, false),
      p_actor)
    returning id into v_id;
  else
    update public.challenges c set
      slug = p_fields ->> 'slug',
      region_id = v_region,
      title = p_fields ->> 'title',
      summary = coalesce(p_fields ->> 'summary', ''),
      description = coalesce(p_fields ->> 'description', ''),
      category = coalesce(p_fields ->> 'category', ''),
      tags = coalesce(array(select jsonb_array_elements_text(p_fields -> 'tags')), '{}'),
      difficulty = p_fields ->> 'difficulty',
      -- Changing points never touches solves.points_awarded.
      points = (p_fields ->> 'points')::integer,
      requires_evidence = coalesce((p_fields ->> 'requiresEvidence')::boolean, true),
      is_sample = coalesce((p_fields ->> 'isSample')::boolean, false)
    where c.id = p_id
    returning c.id into v_id;
    if v_id is null then
      return null;
    end if;
  end if;

  if p_flag_digest is not null then
    insert into private.flag_verifiers (challenge_id, digest, algorithm, updated_at)
    values (v_id, p_flag_digest, 'hmac-sha256-v1', now())
    on conflict (challenge_id) do update set digest = excluded.digest, algorithm = excluded.algorithm, updated_at = now();
  end if;

  insert into private.admin_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values (
    p_actor,
    case when p_id is null then 'challenge.create' else 'challenge.update' end,
    'challenge',
    v_id,
    jsonb_build_object('slug', p_fields ->> 'slug', 'flagChanged', p_flag_digest is not null)
  );

  return v_id;
end;
$$;

-- Publish after validating requirements. Returns:
--   'published' | 'not_found' | 'missing_flag' | 'missing_evidence'
create or replace function public.svc_publish_challenge(p_actor uuid, p_challenge_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requires_evidence boolean;
begin
  select c.requires_evidence into v_requires_evidence
  from public.challenges c where c.id = p_challenge_id
  for update;
  if not found then
    return 'not_found';
  end if;

  if not exists (select 1 from private.flag_verifiers fv where fv.challenge_id = p_challenge_id) then
    return 'missing_flag';
  end if;

  if v_requires_evidence and not exists (
    select 1 from public.evidence_files e
    where e.challenge_id = p_challenge_id and e.is_active and e.upload_status = 'verified'
  ) then
    return 'missing_evidence';
  end if;

  update public.challenges
  set status = 'published', published_at = coalesce(published_at, now())
  where id = p_challenge_id;

  insert into private.admin_audit_logs (actor_user_id, action, entity_type, entity_id)
  values (p_actor, 'challenge.publish', 'challenge', p_challenge_id);
  return 'published';
end;
$$;

-- Archive (hide from players; solves and awarded points are kept).
create or replace function public.svc_archive_challenge(p_actor uuid, p_challenge_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.challenges set status = 'archived' where id = p_challenge_id;
  if not found then
    return 'not_found';
  end if;
  insert into private.admin_audit_logs (actor_user_id, action, entity_type, entity_id)
  values (p_actor, 'challenge.archive', 'challenge', p_challenge_id);
  return 'archived';
end;
$$;

-- Which of the given challenges have a flag verifier (never returns digests).
create or replace function public.svc_challenges_with_flag(p_challenge_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fv.challenge_id from private.flag_verifiers fv where fv.challenge_id = any (p_challenge_ids);
$$;

-- Public solve counts per published challenge.
create or replace function public.svc_solve_counts()
returns table (challenge_id uuid, solve_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select s.challenge_id, count(*)
  from public.solves s
  join public.challenges c on c.id = s.challenge_id and c.status = 'published'
  group by s.challenge_id;
$$;

-- All-time leaderboard. Ranking (documented in docs/database.md):
--   1. total points (sum of points_awarded) descending
--   2. time the total was reached (latest solve) ascending
--   3. username ascending (case-insensitive) as the final stable tie breaker
-- Each player gets a unique position. Players without solves are not listed.
create or replace function public.svc_leaderboard(p_limit integer default 25, p_offset integer default 0)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  avatar_url text,
  points bigint,
  solved_count bigint,
  last_solve_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select s.user_id, sum(s.points_awarded)::bigint as points, count(*)::bigint as solved_count,
           max(s.solved_at) as last_solve_at
    from public.solves s
    group by s.user_id
  ),
  ranked as (
    select row_number() over (order by t.points desc, t.last_solve_at asc, lower(p.username) asc) as rank,
           t.user_id, p.username, p.avatar_url, t.points, t.solved_count, t.last_solve_at,
           count(*) over () as total_count
    from totals t
    join public.profiles p on p.user_id = t.user_id
  )
  select * from ranked r
  order by r.rank
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- One player's rank/total (same ordering as svc_leaderboard).
create or replace function public.svc_user_rank(p_user_id uuid)
returns table (rank bigint, points bigint, solved_count bigint, total_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select s.user_id, sum(s.points_awarded)::bigint as points, count(*)::bigint as solved_count,
           max(s.solved_at) as last_solve_at
    from public.solves s
    group by s.user_id
  ),
  ranked as (
    select row_number() over (order by t.points desc, t.last_solve_at asc, lower(p.username) asc) as rank,
           t.user_id, t.points, t.solved_count, count(*) over () as total_count
    from totals t
    join public.profiles p on p.user_id = t.user_id
  )
  select r.rank, r.points, r.solved_count, r.total_count from ranked r where r.user_id = p_user_id;
$$;

-- Lock every svc_* function down to service_role. Supabase's default
-- privileges grant EXECUTE on new public functions to anon/authenticated.
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'svc\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
