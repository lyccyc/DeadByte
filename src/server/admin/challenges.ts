import "server-only";
import { revalidateTag } from "next/cache";
import type { RegionSlug } from "@/config/regions";
import type { AdminChallengeFields } from "@/lib/admin-validation";
import type { ChallengeStatus, Difficulty } from "@/lib/challenge-types";
import { computeFlagDigest, normalizeFlag } from "@/lib/flags";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CATALOGUE_TAG } from "@/server/catalogue";

/** Admin-side challenge record (includes drafts). Never includes digests or object keys. */
export interface AdminChallenge extends AdminChallengeFields {
  id: string;
  status: ChallengeStatus;
  publishedAt: string | null;
  updatedAt: string;
  hasFlag: boolean;
  evidence: { total: number; verified: number };
}

interface Row {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: Difficulty;
  points: number;
  status: ChallengeStatus;
  requires_evidence: boolean;
  is_sample: boolean;
  published_at: string | null;
  updated_at: string;
  regions: { slug: RegionSlug } | null;
  evidence_files: { upload_status: string; is_active: boolean }[];
}

const SELECT =
  "id, slug, title, summary, description, category, tags, difficulty, points, status, requires_evidence, is_sample, published_at, updated_at, regions(slug), evidence_files(upload_status, is_active)";

function mapRow(r: Row, withFlag: Set<string>): AdminChallenge {
  const active = r.evidence_files.filter((e) => e.is_active);
  return {
    id: r.id,
    slug: r.slug,
    region: r.regions?.slug ?? "antarctica",
    title: r.title,
    summary: r.summary,
    description: r.description,
    category: r.category,
    tags: r.tags,
    difficulty: r.difficulty,
    points: r.points,
    requiresEvidence: r.requires_evidence,
    isSample: r.is_sample,
    status: r.status,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
    hasFlag: withFlag.has(r.id),
    evidence: { total: active.length, verified: active.filter((e) => e.upload_status === "verified").length },
  };
}

async function flagSet(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await createSupabaseAdminClient().rpc("svc_challenges_with_flag", { p_challenge_ids: ids });
  if (error) throw new Error(`flag lookup failed: ${error.code}`);
  return new Set(data as string[]);
}

export async function listAdminChallenges(): Promise<AdminChallenge[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("challenges")
    .select(SELECT)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`challenge list failed: ${error.code}`);
  const rows = data as unknown as Row[];
  const withFlag = await flagSet(rows.map((r) => r.id));
  return rows.map((r) => mapRow(r, withFlag));
}

export async function getAdminChallenge(id: string): Promise<AdminChallenge | null> {
  const { data, error } = await createSupabaseAdminClient().from("challenges").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`challenge read failed: ${error.code}`);
  if (!data) return null;
  return mapRow(data as unknown as Row, await flagSet([id]));
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; status: 400 | 404 | 409 | 500; code: string; message: string };

/** Create (id null) or update a challenge; optionally (re)set its flag. Atomic with the audit log. */
export async function saveAdminChallenge(actorId: string, id: string | null, fields: AdminChallengeFields, flag?: string): Promise<SaveResult> {
  let digest: string | null = null;
  if (flag !== undefined && flag.trim() !== "") {
    const normalized = normalizeFlag(flag);
    if (!normalized.ok) return { ok: false, status: 400, code: "invalid_flag", message: `Invalid flag (${normalized.error}).` };
    digest = computeFlagDigest(process.env.FLAG_HMAC_SECRET!.trim(), normalized.value);
  }

  const { data, error } = await createSupabaseAdminClient().rpc("svc_admin_save_challenge", {
    p_actor: actorId,
    p_id: id,
    p_fields: fields,
    p_flag_digest: digest,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, status: 409, code: "slug_taken", message: "That slug is already used." };
    if (error.code === "23514" || error.code === "22023") {
      return { ok: false, status: 400, code: "invalid_fields", message: "One or more fields are invalid." };
    }
    console.error("[admin] save failed", { code: error.code, message: error.message });
    return { ok: false, status: 500, code: "server_error", message: "Could not save the challenge." };
  }
  if (!data) return { ok: false, status: 404, code: "not_found", message: "Challenge not found." };
  revalidateTag(CATALOGUE_TAG, { expire: 0 });
  return { ok: true, id: data as string };
}

const PUBLISH_MESSAGES: Record<string, { status: 404 | 409; message: string }> = {
  not_found: { status: 404, message: "Challenge not found." },
  missing_flag: { status: 409, message: "Set a flag before publishing." },
  missing_evidence: {
    status: 409,
    message: "This challenge requires at least one verified evidence file. Upload it with npm run upload-evidence and attach it below, or untick “requires evidence”.",
  },
};

export type StatusResult = { ok: true } | { ok: false; status: 404 | 409 | 500; code: string; message: string };

export async function setChallengeStatus(actorId: string, id: string, action: "publish" | "archive"): Promise<StatusResult> {
  const fn = action === "publish" ? "svc_publish_challenge" : "svc_archive_challenge";
  const { data, error } = await createSupabaseAdminClient().rpc(fn, { p_actor: actorId, p_challenge_id: id });
  if (error) {
    console.error(`[admin] ${action} failed`, { code: error.code, message: error.message });
    return { ok: false, status: 500, code: "server_error", message: `Could not ${action} the challenge.` };
  }
  if (data === "published" || data === "archived") {
    revalidateTag(CATALOGUE_TAG, { expire: 0 });
    return { ok: true };
  }
  const known = PUBLISH_MESSAGES[data as string];
  return known
    ? { ok: false, status: known.status, code: data as string, message: known.message }
    : { ok: false, status: 500, code: "server_error", message: "Unexpected response." };
}
