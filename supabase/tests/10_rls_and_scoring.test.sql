-- DeadByte database tests: RLS, privileges, signup trigger, scoring, publishing,
-- leaderboard ordering. Run by scripts/test-db.sh against a DISPOSABLE database.
-- Any failed assertion raises an exception and aborts the run (ON_ERROR_STOP).

\set ON_ERROR_STOP on
set client_min_messages = warning;

create schema dbtest;
grant usage on schema dbtest to public;

create function dbtest.assert(p_cond boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'ASSERTION FAILED: %', p_label;
  end if;
end $$;

-- Executes p_sql as the CURRENT role and requires a privilege / RLS denial.
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

grant execute on all functions in schema dbtest to public;

create function dbtest.as_user(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false);
end $$;
grant execute on function dbtest.as_user(uuid) to public;

-- ---------------------------------------------------------------------------
-- Fixtures (as the migration owner)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000a', 'alice@example.test', '{"username":"alice"}'),
  ('00000000-0000-4000-8000-00000000000b', 'bob@example.test',   '{"username":"ALICE"}'),      -- taken (case-insensitive)
  ('00000000-0000-4000-8000-00000000000c', 'carol@example.test', '{"username":"carol"}'),
  ('00000000-0000-4000-8000-00000000000d', 'admin@example.test', '{"username":"bad name!"}');  -- invalid

-- Signup trigger
select dbtest.assert((select count(*) = 4 from public.profiles), 'trigger creates a profile per user');
select dbtest.assert((select username = 'alice' from public.profiles where user_id = '00000000-0000-4000-8000-00000000000a'), 'requested username kept');
select dbtest.assert((select username like 'agent\_%' from public.profiles where user_id = '00000000-0000-4000-8000-00000000000b'), 'duplicate username falls back');
select dbtest.assert((select username like 'agent\_%' from public.profiles where user_id = '00000000-0000-4000-8000-00000000000d'), 'invalid username falls back');
select dbtest.assert((select count(*) = 4 from private.user_roles where role = 'player'), 'every new user is a player');
select dbtest.assert(public.svc_get_user_role('00000000-0000-4000-8000-00000000000a') = 'player', 'default role player');
select public.svc_set_user_role('00000000-0000-4000-8000-00000000000d', 'admin');
select dbtest.assert(public.svc_get_user_role('00000000-0000-4000-8000-00000000000d') = 'admin', 'admin role assigned');
select dbtest.assert(public.svc_get_user_role(gen_random_uuid()) = 'player', 'unknown user is player');

-- Regions mapping
select dbtest.assert(
  (select string_agg(slug || '=' || forensic_domain, ',' order by sort_order) from public.regions) =
  'antarctica=Memory Forensics,north-america=Disk Forensics,south-america=Mobile Forensics,europe=Network Forensics,africa=Browser Forensics,asia=Cloud Forensics,oceania=File & Artifact Analysis',
  'exact seven-region mapping');

-- Challenges: published (with flag), draft (with flag), archived, published-for-points-change
select public.svc_admin_save_challenge('00000000-0000-4000-8000-00000000000d', null,
  '{"slug":"the-frozen-memory","region":"antarctica","title":"The Frozen Memory","difficulty":"easy","points":100,"requiresEvidence":false,"isSample":true}',
  repeat('a', 64));
select public.svc_admin_save_challenge('00000000-0000-4000-8000-00000000000d', null,
  '{"slug":"secret-draft","region":"europe","title":"Secret Draft","difficulty":"hard","points":300,"requiresEvidence":false}',
  repeat('b', 64));
select public.svc_admin_save_challenge('00000000-0000-4000-8000-00000000000d', null,
  '{"slug":"old-case","region":"asia","title":"Old Case","difficulty":"medium","points":200,"requiresEvidence":false}',
  repeat('c', 64));
select public.svc_admin_save_challenge('00000000-0000-4000-8000-00000000000d', null,
  '{"slug":"needs-evidence","region":"oceania","title":"Needs Evidence","difficulty":"medium","points":150}',
  repeat('d', 64));
select public.svc_admin_save_challenge('00000000-0000-4000-8000-00000000000d', null,
  '{"slug":"no-flag-yet","region":"africa","title":"No Flag Yet","difficulty":"easy","points":50,"requiresEvidence":false}',
  null);

create temp table ids as
  select slug, id from public.challenges;
grant select on ids to public;

-- Publish validation
select dbtest.assert(public.svc_publish_challenge(null, (select id from ids where slug = 'no-flag-yet')) = 'missing_flag', 'publish requires flag');
select dbtest.assert(public.svc_publish_challenge(null, (select id from ids where slug = 'needs-evidence')) = 'missing_evidence', 'publish requires evidence when flagged');
select dbtest.assert(public.svc_publish_challenge(null, gen_random_uuid()) = 'not_found', 'publish unknown');
select dbtest.assert(public.svc_publish_challenge(null, (select id from ids where slug = 'the-frozen-memory')) = 'published', 'publish ok');
select dbtest.assert(public.svc_publish_challenge(null, (select id from ids where slug = 'old-case')) = 'published', 'publish ok 2');
select dbtest.assert(public.svc_archive_challenge(null, (select id from ids where slug = 'old-case')) = 'archived', 'archive ok');

-- Pending evidence does not satisfy the requirement; verified does.
insert into public.evidence_files (challenge_id, display_name, object_key, size_bytes, sha256, upload_status)
select id, 'evidence.7z', 'evidence/challenges/' || id || '/v1/11111111-1111-4111-8111-111111111111.7z', 10, repeat('e', 64), 'pending'
from ids where slug = 'needs-evidence';
select dbtest.assert(public.svc_publish_challenge(null, (select id from ids where slug = 'needs-evidence')) = 'missing_evidence', 'pending evidence rejected');
-- Evidence on a published challenge (verified) for visibility tests
insert into public.evidence_files (challenge_id, display_name, object_key, size_bytes, sha256, upload_status, verified_at)
select id, 'frozen.7z', 'evidence/challenges/' || id || '/v1/22222222-2222-4222-8222-222222222222.7z', 42, repeat('f', 64), 'verified', now()
from ids where slug = 'the-frozen-memory';
-- Verified evidence on the DRAFT challenge must stay hidden
insert into public.evidence_files (challenge_id, display_name, object_key, size_bytes, sha256, upload_status, verified_at)
select id, 'draft.pcap', 'evidence/challenges/' || id || '/v1/33333333-3333-4333-8333-333333333333.pcap', 7, repeat('0', 64), 'verified', now()
from ids where slug = 'secret-draft';

select dbtest.assert(
  (select status from public.challenges where slug = 'secret-draft') = 'draft', 'draft stays draft');
select dbtest.assert(
  (select count(*) = 0 from private.admin_audit_logs where details::text ~* 'aaaa|digest'), 'audit log never stores digests');

-- ---------------------------------------------------------------------------
-- Anonymous visitor
-- ---------------------------------------------------------------------------
select dbtest.as_user(null);
set role anon;

select dbtest.assert((select count(*) = 7 from public.regions), 'anon reads regions');
select dbtest.assert((select array_agg(slug order by slug) = '{the-frozen-memory}' from public.challenges), 'anon sees only published challenges');
select dbtest.assert((select count(*) = 1 from public.evidence_files), 'anon sees only evidence of published challenges');
select dbtest.assert((select count(*) = 4 from public.profiles), 'anon reads public profile fields');
select dbtest.expect_denied('select created_by from public.challenges', 'created_by hidden');
select dbtest.expect_denied('select object_key from public.evidence_files', 'object_key hidden from anon');
select dbtest.expect_denied('select * from public.submissions', 'anon submissions');
select dbtest.expect_denied('select * from public.solves', 'anon solves');
select dbtest.expect_denied('select * from private.flag_verifiers', 'anon flag verifiers');
select dbtest.expect_denied('select * from private.user_roles', 'anon roles');
select dbtest.expect_denied($$select public.svc_submit_flag('00000000-0000-4000-8000-00000000000a', (select id from ids where slug='the-frozen-memory'), repeat('a',64))$$, 'anon cannot call submit');
select dbtest.expect_denied($$select public.svc_leaderboard()$$, 'anon cannot call svc_leaderboard directly');
select dbtest.expect_denied($$insert into public.challenges (slug, region_id, title, difficulty, points) select 'x', id, 'x', 'easy', 1 from public.regions limit 1$$, 'anon cannot create challenges');
reset role;

-- ---------------------------------------------------------------------------
-- Authenticated player (alice)
-- ---------------------------------------------------------------------------
select dbtest.as_user('00000000-0000-4000-8000-00000000000a');
set role authenticated;

select dbtest.assert((select count(*) = 1 from public.challenges), 'player sees only published challenges');
select dbtest.expect_denied('select email from auth.users', 'player cannot read auth emails');
select dbtest.expect_denied('select object_key from public.evidence_files', 'object_key hidden from players');
select dbtest.expect_denied($$insert into public.solves (user_id, challenge_id, points_awarded) select '00000000-0000-4000-8000-00000000000a', id, 9999 from ids where slug='the-frozen-memory'$$, 'player cannot write solves');
select dbtest.expect_denied($$insert into public.submissions (user_id, challenge_id, is_correct) select '00000000-0000-4000-8000-00000000000a', id, true from ids where slug='the-frozen-memory'$$, 'player cannot write submissions');
select dbtest.expect_denied($$select public.svc_submit_flag('00000000-0000-4000-8000-00000000000a', (select id from ids where slug='the-frozen-memory'), repeat('a',64))$$, 'player cannot call submit directly');
select dbtest.expect_denied($$select public.svc_set_user_role('00000000-0000-4000-8000-00000000000a', 'admin')$$, 'player cannot elevate role');
select dbtest.expect_denied($$select public.svc_admin_save_challenge('00000000-0000-4000-8000-00000000000a', null, '{}'::jsonb)$$, 'player cannot call admin save');
select dbtest.expect_denied($$select public.svc_publish_challenge(null, (select id from ids where slug='secret-draft'))$$, 'player cannot publish');
select dbtest.expect_denied($$update public.profiles set user_id = gen_random_uuid() where user_id = '00000000-0000-4000-8000-00000000000a'$$, 'player cannot change profile user_id');
select dbtest.expect_denied($$update public.challenges set points = 1$$, 'player cannot edit challenges');

-- Own profile edit works; other profiles are untouched (RLS filters rows).
update public.profiles set username = 'alice_x' where user_id = '00000000-0000-4000-8000-00000000000a';
update public.profiles set username = 'pwned' where user_id = '00000000-0000-4000-8000-00000000000c';
reset role;
select dbtest.assert((select username = 'alice_x' from public.profiles where user_id = '00000000-0000-4000-8000-00000000000a'), 'player edits own username');
select dbtest.assert((select username = 'carol' from public.profiles where user_id = '00000000-0000-4000-8000-00000000000c'), 'player cannot edit another profile');
update public.profiles set username = 'alice' where user_id = '00000000-0000-4000-8000-00000000000a';

-- ---------------------------------------------------------------------------
-- Scoring through the trusted function (as service_role, like the server)
-- ---------------------------------------------------------------------------
set role service_role;

select dbtest.assert((select result = 'incorrect' and points_awarded = 0
  from public.svc_submit_flag('00000000-0000-4000-8000-00000000000a', (select id from ids where slug='the-frozen-memory'), repeat('9', 64))), 'wrong flag incorrect');
select dbtest.assert((select result = 'incorrect'
  from public.svc_submit_flag('00000000-0000-4000-8000-00000000000a', (select id from ids where slug='the-frozen-memory'), 'not-hex')), 'malformed digest incorrect');
select dbtest.assert((select result = 'solved' and points_awarded = 100
  from public.svc_submit_flag('00000000-0000-4000-8000-00000000000a', (select id from ids where slug='the-frozen-memory'), repeat('a', 64))), 'first correct solve awards points');
select dbtest.assert((select result = 'already_solved' and points_awarded = 0
  from public.svc_submit_flag('00000000-0000-4000-8000-00000000000a', (select id from ids where slug='the-frozen-memory'), repeat('a', 64))), 'repeat correct awards zero');
select dbtest.assert((select result = 'not_found'
  from public.svc_submit_flag('00000000-0000-4000-8000-00000000000a', (select id from ids where slug='secret-draft'), repeat('b', 64))), 'draft not submittable');
select dbtest.assert((select result = 'not_found'
  from public.svc_submit_flag('00000000-0000-4000-8000-00000000000a', (select id from ids where slug='old-case'), repeat('c', 64))), 'archived not submittable');
select dbtest.assert((select count(*) = 1 from public.solves where user_id = '00000000-0000-4000-8000-00000000000a'), 'exactly one solve');
select dbtest.assert((select count(*) = 4 from public.submissions where user_id = '00000000-0000-4000-8000-00000000000a'), 'attempts on published challenges recorded');
reset role;

-- Editing points later does not change awarded points
select public.svc_admin_save_challenge('00000000-0000-4000-8000-00000000000d', (select id from ids where slug = 'the-frozen-memory'),
  '{"slug":"the-frozen-memory","region":"antarctica","title":"The Frozen Memory","difficulty":"easy","points":500,"requiresEvidence":false,"isSample":true}');
select dbtest.assert((select points = 500 from public.challenges where slug = 'the-frozen-memory'), 'points updated');
select dbtest.assert((select points_awarded = 100 from public.solves where user_id = '00000000-0000-4000-8000-00000000000a'), 'awarded points unchanged');
select dbtest.assert((select count(*) = 1 from private.flag_verifiers where digest = repeat('a', 64)), 'update without digest keeps flag');

-- carol solves at the new value (500)
select dbtest.assert((select result = 'solved' and points_awarded = 500
  from public.svc_submit_flag('00000000-0000-4000-8000-00000000000c', (select id from ids where slug='the-frozen-memory'), repeat('a', 64))), 'later solver gets current points');

-- Rate limit: bob makes 10 wrong attempts, the 11th is limited and not recorded
do $$
declare i int;
begin
  for i in 1..10 loop
    perform dbtest.assert((select result = 'incorrect' from public.svc_submit_flag('00000000-0000-4000-8000-00000000000b',
      (select id from ids where slug='the-frozen-memory'), repeat('1', 64))), 'attempt ' || i);
  end loop;
end $$;
select dbtest.assert((select result = 'rate_limited' and retry_after_seconds between 1 and 60
  from public.svc_submit_flag('00000000-0000-4000-8000-00000000000b', (select id from ids where slug='the-frozen-memory'), repeat('a', 64))), 'rate limited with retry-after');
select dbtest.assert((select count(*) = 10 from public.submissions where user_id = '00000000-0000-4000-8000-00000000000b'), 'limited attempt not recorded');
select dbtest.assert((select count(*) = 0 from public.solves where user_id = '00000000-0000-4000-8000-00000000000b'), 'limited correct flag not awarded');

-- ---------------------------------------------------------------------------
-- Privacy between players
-- ---------------------------------------------------------------------------
select dbtest.as_user('00000000-0000-4000-8000-00000000000b');
set role authenticated;
select dbtest.assert((select count(*) = 10 from public.submissions), 'bob sees only his submissions');
select dbtest.assert((select count(*) = 0 from public.solves), 'bob cannot see others'' solves');
reset role;

select dbtest.as_user('00000000-0000-4000-8000-00000000000a');
set role authenticated;
select dbtest.assert((select count(*) = 4 from public.submissions), 'alice sees only her submissions');
select dbtest.assert((select count(*) = 1 and min(points_awarded) = 100 from public.solves), 'alice sees her solve');
reset role;
select dbtest.as_user(null);

-- ---------------------------------------------------------------------------
-- Leaderboard: carol 500 > alice 100; tie order by time then username
-- ---------------------------------------------------------------------------
select dbtest.assert(
  (select string_agg(username || ':' || points, ',' order by rank) from public.svc_leaderboard(10, 0)) = 'carol:500,alice:100',
  'leaderboard ordering by points');
select dbtest.assert((select total_count = 2 from public.svc_leaderboard(1, 0)), 'leaderboard total count');
select dbtest.assert((select count(*) = 1 from public.svc_leaderboard(1, 1)), 'leaderboard pagination');
select dbtest.assert((select rank = 2 and points = 100 from public.svc_user_rank('00000000-0000-4000-8000-00000000000a')), 'user rank');

-- Tie: give alice +400 from a second challenge solved LATER than carol -> carol stays first (reached earlier)
select public.svc_admin_save_challenge('00000000-0000-4000-8000-00000000000d', (select id from ids where slug = 'secret-draft'),
  '{"slug":"secret-draft","region":"europe","title":"Secret Draft","difficulty":"hard","points":400,"requiresEvidence":false}');
select public.svc_publish_challenge(null, (select id from ids where slug = 'secret-draft'));
select dbtest.assert((select result = 'solved' and points_awarded = 400
  from public.svc_submit_flag('00000000-0000-4000-8000-00000000000a', (select id from ids where slug='secret-draft'), repeat('b', 64))), 'alice second solve');
select dbtest.assert(
  (select string_agg(username || ':' || points, ',' order by rank) from public.svc_leaderboard(10, 0)) = 'carol:500,alice:500',
  'tie broken by earliest time the score was reached');
select dbtest.assert((select count(*) = 2 from public.svc_solve_counts()), 'solve counts per challenge');

-- Archiving keeps awarded points on the leaderboard
select public.svc_archive_challenge(null, (select id from ids where slug = 'secret-draft'));
select dbtest.assert((select points = 500 from public.svc_leaderboard(10, 0) where username = 'alice'), 'archived challenge points kept');

drop schema dbtest cascade;
\echo 'rls_and_scoring: ALL ASSERTIONS PASSED'
