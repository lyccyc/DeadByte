-- DeadByte database tests: Phase 3 evidence registration, activation and
-- download grants. Runs after 10_rls_and_scoring.test.sql (reuses dbtest.*).

\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Assertion helpers (same as 10_rls_and_scoring, which drops its copy).
create schema dbtest;
grant usage on schema dbtest to public;
create function dbtest.assert(p_cond boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'ASSERTION FAILED: %', p_label;
  end if;
end $$;
create function dbtest.expect_denied(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when insufficient_privilege then
    return;
  end;
  raise exception 'EXPECTED DENIAL: %', p_label;
end $$;
create function dbtest.as_user(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false);
end $$;
grant execute on all functions in schema dbtest to public;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000e1', 'evi-player@example.test', '{"username":"evi_player"}'),
  ('00000000-0000-4000-8000-0000000000e2', 'evi-other@example.test',  '{"username":"evi_other"}'),
  ('00000000-0000-4000-8000-0000000000ed', 'evi-admin@example.test',  '{"username":"evi_admin"}');
select public.svc_set_user_role('00000000-0000-4000-8000-0000000000ed', 'admin');

select public.svc_admin_save_challenge('00000000-0000-4000-8000-0000000000ed', null,
  '{"slug":"evi-published","region":"antarctica","title":"Evidence Published","difficulty":"easy","points":100}', repeat('a', 64));
select public.svc_admin_save_challenge('00000000-0000-4000-8000-0000000000ed', null,
  '{"slug":"evi-draft","region":"europe","title":"Evidence Draft","difficulty":"easy","points":100}', repeat('b', 64));

create temp table eids as select slug, id from public.challenges where slug like 'evi-%';
grant select on eids to public;

-- Evidence ids used below
--   e0000001: valid file for evi-published
--   e0000002: second valid file for evi-published
--   e0000003: file for evi-draft
create temp table ef (name text, id uuid);
insert into ef values
  ('pub1', 'e0000001-0000-4000-8000-000000000001'),
  ('pub2', 'e0000002-0000-4000-8000-000000000002'),
  ('draft', 'e0000003-0000-4000-8000-000000000003');
grant select on ef to public;

create function dbtest.key(p_challenge text, p_file text, p_ext text default '.7z') returns text
language sql as $$
  select 'evidence/challenges/' || (select id from eids where slug = p_challenge) || '/v1/'
         || (select id from ef where name = p_file) || p_ext
$$;
grant execute on function dbtest.key(text, text, text) to public;

-- ---------------------------------------------------------------------------
-- Registration (service_role, like the server / operator CLI)
-- ---------------------------------------------------------------------------
set role service_role;

-- Key must embed this challenge id AND this evidence id.
select dbtest.assert(public.svc_register_evidence('00000000-0000-4000-8000-0000000000ed',
  (select id from eids where slug = 'evi-published'), (select id from ef where name = 'pub1'),
  dbtest.key('evi-draft', 'pub1'), 'frozen.7z', 42, repeat('f', 64)) = 'key_mismatch', 'key for another challenge rejected');
select dbtest.assert(public.svc_register_evidence(null,
  (select id from eids where slug = 'evi-published'), (select id from ef where name = 'pub1'),
  dbtest.key('evi-published', 'pub2'), 'frozen.7z', 42, repeat('f', 64)) = 'key_mismatch', 'key for another file id rejected');
select dbtest.assert(public.svc_register_evidence(null,
  (select id from eids where slug = 'evi-published'), (select id from ef where name = 'pub1'),
  '../' || dbtest.key('evi-published', 'pub1'), 'frozen.7z', 42, repeat('f', 64)) = 'key_mismatch', 'path prefix rejected');
select dbtest.assert(public.svc_register_evidence(null,
  gen_random_uuid(), (select id from ef where name = 'pub1'),
  dbtest.key('evi-published', 'pub1'), 'frozen.7z', 42, repeat('f', 64)) = 'key_mismatch', 'unknown challenge (key mismatch)');

do $$ begin
  perform public.svc_register_evidence(null, (select id from eids where slug = 'evi-published'), (select id from ef where name = 'pub1'),
    dbtest.key('evi-published', 'pub1'), 'frozen.7z', 42, 'NOT-A-SHA');
  raise exception 'EXPECTED invalid sha rejection';
exception when sqlstate '22023' then null;
end $$;

-- Not publishable before evidence exists
select dbtest.assert(public.svc_publish_challenge(null, (select id from eids where slug = 'evi-published')) = 'missing_evidence', 'publish needs evidence');

select dbtest.assert(public.svc_register_evidence('00000000-0000-4000-8000-0000000000ed',
  (select id from eids where slug = 'evi-published'), (select id from ef where name = 'pub1'),
  dbtest.key('evi-published', 'pub1'), 'frozen.7z', 42, repeat('f', 64), 'application/x-7z-compressed') = 'registered', 'register ok');
select dbtest.assert(public.svc_register_evidence(null,
  (select id from eids where slug = 'evi-published'), (select id from ef where name = 'pub1'),
  dbtest.key('evi-published', 'pub1'), 'frozen.7z', 42, repeat('f', 64)) = 'already_registered', 'register is idempotent');
select dbtest.assert(public.svc_register_evidence(null,
  (select id from eids where slug = 'evi-published'), (select id from ef where name = 'pub1'),
  dbtest.key('evi-published', 'pub1'), 'frozen.7z', 43, repeat('f', 64)) = 'conflict', 'different metadata for same id conflicts');
select dbtest.assert(public.svc_register_evidence(null,
  (select id from eids where slug = 'evi-draft'), (select id from ef where name = 'draft'),
  dbtest.key('evi-draft', 'draft', '.pcap'), 'draft.pcap', 7, repeat('0', 64)) = 'registered', 'register on draft ok');
reset role;

select dbtest.assert((select upload_status = 'verified' and verified_at is not null and is_active
  from public.evidence_files where id = (select id from ef where name = 'pub1')), 'registered file verified + active');
select dbtest.assert((select count(*) = 2 from private.admin_audit_logs where action = 'evidence.register'), 'registration audit-logged once per new file');

select dbtest.assert(public.svc_publish_challenge(null, (select id from eids where slug = 'evi-published')) = 'published', 'publish with verified evidence');

-- ---------------------------------------------------------------------------
-- Players and anonymous callers cannot use the evidence functions
-- ---------------------------------------------------------------------------
select dbtest.as_user('00000000-0000-4000-8000-0000000000e1');
set role authenticated;
select dbtest.expect_denied($$select public.svc_register_evidence(null, gen_random_uuid(), gen_random_uuid(), 'x', 'x', 1, repeat('a', 64))$$, 'player cannot register evidence');
select dbtest.expect_denied($$select public.svc_set_evidence_active(null, gen_random_uuid(), false)$$, 'player cannot toggle evidence');
select dbtest.expect_denied($$select * from public.svc_grant_evidence_download('00000000-0000-4000-8000-0000000000e1', gen_random_uuid())$$, 'player cannot self-grant downloads');
select dbtest.expect_denied('select * from private.evidence_download_grants', 'player cannot read grants');
select dbtest.expect_denied('select object_key from public.evidence_files', 'object_key still hidden');
select dbtest.assert((select count(*) = 1 from public.evidence_files e join eids on eids.id = e.challenge_id), 'player sees only published evidence');
reset role;

select dbtest.as_user(null);
set role anon;
select dbtest.expect_denied($$select * from public.svc_grant_evidence_download(gen_random_uuid(), gen_random_uuid())$$, 'anon cannot grant downloads');
select dbtest.expect_denied('select * from private.evidence_download_grants', 'anon cannot read grants');
reset role;

-- ---------------------------------------------------------------------------
-- Download grants
-- ---------------------------------------------------------------------------
set role service_role;
select dbtest.assert((select outcome = 'granted' and object_key = dbtest.key('evi-published', 'pub1') and size_bytes = 42 and sha256 = repeat('f', 64)
  from public.svc_grant_evidence_download('00000000-0000-4000-8000-0000000000e1', (select id from ef where name = 'pub1'), 3, 3600)), 'grant published evidence');
select dbtest.assert((select outcome = 'not_found' and object_key is null
  from public.svc_grant_evidence_download('00000000-0000-4000-8000-0000000000e1', (select id from ef where name = 'draft'), 3, 3600)), 'draft evidence denied');
select dbtest.assert((select outcome = 'not_found'
  from public.svc_grant_evidence_download('00000000-0000-4000-8000-0000000000e1', gen_random_uuid(), 3, 3600)), 'unknown evidence denied');
-- Rate limit: 3 per window; denied attempts above did not count.
select dbtest.assert((select outcome = 'granted' from public.svc_grant_evidence_download('00000000-0000-4000-8000-0000000000e1', (select id from ef where name = 'pub1'), 3, 3600)), 'grant 2');
select dbtest.assert((select outcome = 'granted' from public.svc_grant_evidence_download('00000000-0000-4000-8000-0000000000e1', (select id from ef where name = 'pub1'), 3, 3600)), 'grant 3');
select dbtest.assert((select outcome = 'rate_limited' and object_key is null and retry_after_seconds between 1 and 3600
  from public.svc_grant_evidence_download('00000000-0000-4000-8000-0000000000e1', (select id from ef where name = 'pub1'), 3, 3600)), 'grant 4 rate limited');
select dbtest.assert((select outcome = 'granted' from public.svc_grant_evidence_download('00000000-0000-4000-8000-0000000000e2', (select id from ef where name = 'pub1'), 3, 3600)), 'limit is per user');
reset role;
select dbtest.assert((select count(*) = 4 from private.evidence_download_grants), 'only successful grants recorded');

-- ---------------------------------------------------------------------------
-- Activation rules
-- ---------------------------------------------------------------------------
set role service_role;
select dbtest.assert(public.svc_set_evidence_active(null, (select id from ef where name = 'pub1'), false) = 'last_required_evidence', 'cannot remove last required evidence of a published case');
select dbtest.assert(public.svc_register_evidence(null,
  (select id from eids where slug = 'evi-published'), (select id from ef where name = 'pub2'),
  dbtest.key('evi-published', 'pub2', '.E01'), 'disk.E01', 1024, repeat('c', 64)) = 'registered', 'register second file');
select dbtest.assert(public.svc_set_evidence_active('00000000-0000-4000-8000-0000000000ed', (select id from ef where name = 'pub1'), false) = 'updated', 'deactivate when another file remains');
select dbtest.assert((select outcome = 'not_found'
  from public.svc_grant_evidence_download('00000000-0000-4000-8000-0000000000e2', (select id from ef where name = 'pub1'), 3, 3600)), 'inactive evidence denied');
select dbtest.assert(public.svc_set_evidence_active(null, gen_random_uuid(), false) = 'not_found', 'toggle unknown');
select dbtest.assert(public.svc_set_evidence_active(null, (select id from ef where name = 'draft'), false) = 'updated', 'draft evidence can be deactivated');
reset role;

-- Archived challenge evidence is not downloadable
select public.svc_archive_challenge(null, (select id from eids where slug = 'evi-published'));
set role service_role;
select dbtest.assert((select outcome = 'not_found'
  from public.svc_grant_evidence_download('00000000-0000-4000-8000-0000000000e2', (select id from ef where name = 'pub2'), 3, 3600)), 'archived evidence denied');
reset role;

select dbtest.assert((select count(*) = 0 from private.admin_audit_logs where details::text ~* 'object_key|r2\.cloudflarestorage|X-Amz'), 'audit log has no keys or URLs');

drop schema dbtest cascade;
\echo 'evidence: ALL ASSERTIONS PASSED'
