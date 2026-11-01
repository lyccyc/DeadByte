-- =============================================================================
-- DeadByte — Phase 3 evidence workflow
--
-- Evidence bytes live in a private Cloudflare R2 bucket. This migration adds
-- only metadata operations, all service-only (EXECUTE granted to service_role):
--
--   svc_register_evidence       attach an uploaded, server-verified R2 object to a challenge
--   svc_set_evidence_active     deactivate / reactivate an evidence file
--   svc_grant_evidence_download authorize + rate-limit + record a player's download grant
--
-- Signed URLs are created by the Next.js server AFTER a 'granted' result and
-- are never stored here (they are bearer capabilities).
--
-- Rollback: supabase/rollbacks/20261101120000_evidence.down.sql
-- =============================================================================

-- Download grants: rate limiting and abuse review. No URLs, IPs or tokens.
create table private.evidence_download_grants (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  evidence_id uuid not null references public.evidence_files (id) on delete cascade,
  granted_at timestamptz not null default now()
);

create index evidence_download_grants_user_idx on private.evidence_download_grants (user_id, granted_at desc);
create index evidence_download_grants_evidence_idx on private.evidence_download_grants (evidence_id);

alter table private.evidence_download_grants enable row level security;
revoke all on private.evidence_download_grants from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Register (attach) evidence. The caller (server route or operator CLI) must
-- already have verified with an R2 HEAD request that the object exists with
-- exactly p_size_bytes and the recorded SHA-256 metadata.
--
-- The object key must be the immutable layout
--   evidence/challenges/<p_challenge_id>/v<n>/<p_evidence_id>[.ext]
-- so a key can never be attached to a different challenge or row.
--
-- Returns: 'registered' | 'already_registered' | 'challenge_not_found'
--        | 'key_mismatch' | 'conflict'
-- -----------------------------------------------------------------------------
create or replace function public.svc_register_evidence(
  p_actor uuid,
  p_challenge_id uuid,
  p_evidence_id uuid,
  p_object_key text,
  p_display_name text,
  p_size_bytes bigint,
  p_sha256 text,
  p_mime_type text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.evidence_files%rowtype;
begin
  if p_sha256 !~ '^[0-9a-f]{64}$' or p_size_bytes is null or p_size_bytes < 0 then
    raise exception 'invalid evidence metadata' using errcode = '22023';
  end if;

  if p_object_key !~ ('^evidence/challenges/' || p_challenge_id::text || '/v[0-9]+/' || p_evidence_id::text
                      || '(\.[A-Za-z0-9]{1,10}){0,2}$') then
    return 'key_mismatch';
  end if;

  perform 1 from public.challenges c where c.id = p_challenge_id for update;
  if not found then
    return 'challenge_not_found';
  end if;

  select * into v_existing from public.evidence_files e where e.id = p_evidence_id or e.object_key = p_object_key limit 1;
  if found then
    if v_existing.id = p_evidence_id and v_existing.object_key = p_object_key
       and v_existing.challenge_id = p_challenge_id and v_existing.sha256 = p_sha256
       and v_existing.size_bytes = p_size_bytes then
      if v_existing.upload_status = 'verified' then
        return 'already_registered';
      end if;
      update public.evidence_files set upload_status = 'verified', verified_at = now() where id = p_evidence_id;
    else
      return 'conflict';
    end if;
  else
    insert into public.evidence_files
      (id, challenge_id, display_name, object_key, size_bytes, sha256, mime_type, upload_status, verified_at, is_active)
    values
      (p_evidence_id, p_challenge_id, p_display_name, p_object_key, p_size_bytes, p_sha256, p_mime_type, 'verified', now(), true);
  end if;

  insert into private.admin_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values (p_actor, 'evidence.register', 'evidence', p_evidence_id,
          jsonb_build_object('challengeId', p_challenge_id, 'sizeBytes', p_size_bytes, 'sha256', p_sha256));
  return 'registered';
end;
$$;

-- -----------------------------------------------------------------------------
-- Activate / deactivate evidence. Deactivating the last verified file of a
-- published challenge that requires evidence is refused (archive it first).
-- Returns: 'updated' | 'not_found' | 'last_required_evidence'
-- -----------------------------------------------------------------------------
create or replace function public.svc_set_evidence_active(p_actor uuid, p_evidence_id uuid, p_active boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge uuid;
  v_status text;
  v_requires boolean;
begin
  select e.challenge_id into v_challenge from public.evidence_files e where e.id = p_evidence_id;
  if not found then
    return 'not_found';
  end if;

  select c.status, c.requires_evidence into v_status, v_requires
  from public.challenges c where c.id = v_challenge
  for update;

  if not p_active and v_status = 'published' and v_requires and not exists (
    select 1 from public.evidence_files e
    where e.challenge_id = v_challenge and e.id <> p_evidence_id and e.is_active and e.upload_status = 'verified'
  ) then
    return 'last_required_evidence';
  end if;

  update public.evidence_files set is_active = p_active where id = p_evidence_id;

  insert into private.admin_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values (p_actor, case when p_active then 'evidence.activate' else 'evidence.deactivate' end,
          'evidence', p_evidence_id, jsonb_build_object('challengeId', v_challenge));
  return 'updated';
end;
$$;

-- -----------------------------------------------------------------------------
-- Authorize a download grant for a player, atomically:
--   * per-user advisory lock (concurrent requests cannot exceed the limit);
--   * evidence must be active + verified and belong to a PUBLISHED challenge
--     (draft/archived/unknown all look identical: 'not_found');
--   * at most p_max_grants grants per rolling p_window_seconds;
--   * the grant is recorded.
-- The object key is returned only to the trusted server, which signs a
-- short-lived R2 URL. Outcome: 'granted' | 'not_found' | 'rate_limited'.
-- -----------------------------------------------------------------------------
create or replace function public.svc_grant_evidence_download(
  p_user_id uuid,
  p_evidence_id uuid,
  p_max_grants integer default 30,
  p_window_seconds integer default 3600
)
returns table (
  outcome text,
  object_key text,
  display_name text,
  size_bytes bigint,
  sha256 text,
  mime_type text,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file public.evidence_files%rowtype;
  v_window interval := make_interval(secs => greatest(coalesce(p_window_seconds, 3600), 60));
  v_max integer := greatest(coalesce(p_max_grants, 30), 1);
  v_count integer;
  v_oldest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('deadbyte.download:' || p_user_id::text, 0));

  select e.* into v_file
  from public.evidence_files e
  join public.challenges c on c.id = e.challenge_id
  where e.id = p_evidence_id and e.is_active and e.upload_status = 'verified' and c.status = 'published';
  if not found then
    return query select 'not_found'::text, null::text, null::text, null::bigint, null::text, null::text, 0;
    return;
  end if;

  select count(*), min(g.granted_at) into v_count, v_oldest
  from private.evidence_download_grants g
  where g.user_id = p_user_id and g.granted_at > now() - v_window;

  if v_count >= v_max then
    return query select 'rate_limited'::text, null::text, null::text, null::bigint, null::text, null::text,
      greatest(1, ceil(extract(epoch from (v_oldest + v_window - now())))::integer);
    return;
  end if;

  insert into private.evidence_download_grants (user_id, evidence_id) values (p_user_id, p_evidence_id);

  return query select 'granted'::text, v_file.object_key, v_file.display_name, v_file.size_bytes,
    v_file.sha256, v_file.mime_type, 0;
end;
$$;

-- Lock the new svc_* functions down to service_role (same rule as the core schema).
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('svc_register_evidence', 'svc_set_evidence_active', 'svc_grant_evidence_download')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
