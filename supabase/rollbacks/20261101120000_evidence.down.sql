-- Rollback for 20261101120000_evidence.sql
-- Drops the Phase 3 evidence functions and the download-grant log (grant history is lost).
-- Evidence metadata rows in public.evidence_files are kept (that table belongs to the core schema).

drop function if exists public.svc_grant_evidence_download(uuid, uuid, integer, integer);
drop function if exists public.svc_set_evidence_active(uuid, uuid, boolean);
drop function if exists public.svc_register_evidence(uuid, uuid, uuid, text, text, bigint, text, text);
drop table if exists private.evidence_download_grants;
