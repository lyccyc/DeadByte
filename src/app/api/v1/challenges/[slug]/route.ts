import type { NextRequest } from "next/server";
import { getPublishedChallenge } from "@/lib/challenges";
import { jsonError, jsonOk, toPublicChallenge } from "@/lib/api";

/** GET /api/v1/challenges/:slug — published challenge detail; drafts/archived return 404. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/v1/challenges/[slug]">) {
  const { slug } = await ctx.params;
  const challenge = await getPublishedChallenge(slug);
  if (!challenge) return jsonError(404, "not_found", "Challenge not found.");
  return jsonOk(toPublicChallenge(challenge));
}
