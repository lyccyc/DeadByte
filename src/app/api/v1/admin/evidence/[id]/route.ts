import type { NextRequest } from "next/server";
import { z } from "zod";
import { PRIVATE_NO_STORE, isUuid, jsonError, jsonOk, readJson } from "@/lib/api";
import { setEvidenceActive } from "@/server/admin/evidence";
import { guardAdmin } from "../../guard";

const bodySchema = z.object({ active: z.boolean() }).strict();

/** PATCH /api/v1/admin/evidence/:id   body: {"active": boolean} */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/v1/admin/evidence/[id]">) {
  const headers = PRIVATE_NO_STORE;
  const guard = await guardAdmin(request, { mutation: true });
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "not_found", "Evidence not found.", undefined, { headers });
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, "invalid_body", 'Expected JSON body {"active": true|false}.', undefined, { headers });
  const result = await setEvidenceActive(guard.user.id, id.toLowerCase(), parsed.data.active);
  if (!result.ok) return jsonError(result.status, result.code, result.message, undefined, { headers });
  return jsonOk({ id, active: parsed.data.active }, { headers });
}
