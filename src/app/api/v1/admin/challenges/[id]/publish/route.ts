import type { NextRequest } from "next/server";
import { PRIVATE_NO_STORE, isUuid, jsonError, jsonOk } from "@/lib/api";
import { setChallengeStatus } from "@/server/admin/challenges";
import { guardAdmin } from "../../../guard";

/** POST /api/v1/admin/challenges/:id/publish */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v1/admin/challenges/[id]/publish">) {
  const guard = await guardAdmin(request, { mutation: true });
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "not_found", "Challenge not found.", undefined, { headers: PRIVATE_NO_STORE });
  const result = await setChallengeStatus(guard.user.id, id, "publish");
  if (!result.ok) return jsonError(result.status, result.code, result.message, undefined, { headers: PRIVATE_NO_STORE });
  return jsonOk({ id, status: "published" }, { headers: PRIVATE_NO_STORE });
}
