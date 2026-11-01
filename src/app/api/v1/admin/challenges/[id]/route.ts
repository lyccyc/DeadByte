import type { NextRequest } from "next/server";
import { z } from "zod";
import { PRIVATE_NO_STORE, isUuid, jsonError, jsonOk, readJson } from "@/lib/api";
import { adminChallengeFieldsSchema, adminPatchSchema } from "@/lib/admin-validation";
import { getAdminChallenge, saveAdminChallenge } from "@/server/admin/challenges";
import { guardAdmin } from "../../guard";

const headers = PRIVATE_NO_STORE;

/** GET /api/v1/admin/challenges/:id */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/v1/admin/challenges/[id]">) {
  const guard = await guardAdmin(request, { mutation: false });
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const challenge = isUuid(id) ? await getAdminChallenge(id) : null;
  if (!challenge) return jsonError(404, "not_found", "Challenge not found.", undefined, { headers });
  return jsonOk(challenge, { headers });
}

/** PATCH /api/v1/admin/challenges/:id — update permitted fields (status changes use publish/archive). */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/v1/admin/challenges/[id]">) {
  const guard = await guardAdmin(request, { mutation: true });
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "not_found", "Challenge not found.", undefined, { headers });

  const parsed = adminPatchSchema.safeParse(await readJson(request, 64_000));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Invalid challenge fields.", z.flattenError(parsed.error).fieldErrors, { headers });
  }
  const existing = await getAdminChallenge(id);
  if (!existing) return jsonError(404, "not_found", "Challenge not found.", undefined, { headers });

  const { flag, ...patch } = parsed.data;
  const merged = adminChallengeFieldsSchema.parse({
    slug: existing.slug,
    region: existing.region,
    title: existing.title,
    summary: existing.summary,
    description: existing.description,
    category: existing.category,
    tags: existing.tags,
    difficulty: existing.difficulty,
    points: existing.points,
    requiresEvidence: existing.requiresEvidence,
    isSample: existing.isSample,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
  });
  const result = await saveAdminChallenge(guard.user.id, id, merged, flag);
  if (!result.ok) return jsonError(result.status, result.code, result.message, undefined, { headers });
  return jsonOk({ id }, { headers });
}
