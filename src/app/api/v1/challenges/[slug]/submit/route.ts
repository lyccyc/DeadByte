import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getConfigState, getSubmissionRateLimit } from "@/lib/app-config";
import { PRIVATE_NO_STORE, isSameOrigin, isUuid, jsonError, readJson } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/server/auth";
import { CATALOGUE_TAG } from "@/server/catalogue";
import { LEADERBOARD_TAG } from "@/server/leaderboard";
import { submitFlag, type SubmitRpc } from "@/server/submissions/submit-flag";

/**
 * POST /api/v1/challenges/:id/submit   body: {"flag":"DEADBYTE{...}"}
 *
 * The dynamic segment is named `[slug]` because it shares a level with
 * GET /api/v1/challenges/:slug (Next.js requires one name per level); here
 * its value is the challenge UUID.
 */
const bodySchema = z.object({ flag: z.string().max(1024) }).strict();

export async function POST(request: NextRequest, ctx: RouteContext<"/api/v1/challenges/[slug]/submit">) {
  const headers = PRIVATE_NO_STORE;
  if (!getConfigState().accountsEnabled) {
    return jsonError(503, "not_configured", "Flag verification is not connected in demo mode.", undefined, { headers });
  }
  if (!isSameOrigin(request)) return jsonError(403, "bad_origin", "Cross-site request rejected.", undefined, { headers });

  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthenticated", "Sign in to submit flags.", undefined, { headers });

  const { slug: challengeId } = await ctx.params;
  if (!isUuid(challengeId)) return jsonError(404, "not_found", "Challenge not found.", undefined, { headers });

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, "invalid_body", 'Expected JSON body {"flag": "..."}.', undefined, { headers });

  const admin = createSupabaseAdminClient();
  const rpc: SubmitRpc = async (args) => {
    const { data, error } = await admin.rpc("svc_submit_flag", args);
    return { data, error };
  };

  const outcome = await submitFlag({
    userId: user.id,
    challengeId,
    flag: parsed.data.flag,
    secret: process.env.FLAG_HMAC_SECRET!.trim(),
    maxPerMinute: getSubmissionRateLimit(),
    rpc,
  });

  if (outcome.status === 200) {
    if (outcome.newSolve) {
      // Solve counts and rankings changed: make the next read fresh.
      revalidateTag(CATALOGUE_TAG, { expire: 0 });
      revalidateTag(LEADERBOARD_TAG, { expire: 0 });
    }
    return Response.json(outcome.body, { headers });
  }
  if (outcome.status === 429) {
    return jsonError(429, outcome.code, outcome.message, undefined, {
      headers: { ...headers, "Retry-After": String(outcome.retryAfterSeconds) },
    });
  }
  return jsonError(outcome.status, outcome.code, outcome.message, undefined, { headers });
}
