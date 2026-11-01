-- Rollback for 20261031120000_core_schema.sql
-- DESTRUCTIVE: drops all DeadByte tables and data (solves, submissions, challenges, flags, roles).
-- Run only on a development database or after a verified backup.

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.svc_user_rank(uuid);
drop function if exists public.svc_leaderboard(integer, integer);
drop function if exists public.svc_solve_counts();
drop function if exists public.svc_challenges_with_flag(uuid[]);
drop function if exists public.svc_archive_challenge(uuid, uuid);
drop function if exists public.svc_publish_challenge(uuid, uuid);
drop function if exists public.svc_admin_save_challenge(uuid, uuid, jsonb, text);
drop function if exists public.svc_set_user_role(uuid, text, uuid);
drop function if exists public.svc_get_user_role(uuid);
drop function if exists public.svc_submit_flag(uuid, uuid, text, integer);

drop table if exists private.admin_audit_logs;
drop table if exists public.solves;
drop table if exists public.submissions;
drop table if exists private.flag_verifiers;
drop table if exists public.evidence_files;
drop table if exists public.challenges;
drop table if exists private.user_roles;
drop table if exists public.profiles;
drop table if exists public.regions;

drop function if exists private.handle_new_user();
drop function if exists private.set_updated_at();
drop schema if exists private;
