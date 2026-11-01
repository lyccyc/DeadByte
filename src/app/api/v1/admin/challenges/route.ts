import type { NextRequest } from "next/server";
import { z } from "zod";
import { PRIVATE_NO_STORE, jsonError, jsonOk, readJson } from "@/lib/api";
import { adminCreateSchema } from "@/lib/admin-validation";
import { listAdminChallenges, saveAdminChallenge } from "@/server/admin/challenges";
import { guardAdmin } from "../guard";

const headers = PRIVATE_NO_STORE;

/** GET /api/v1/admin/challenges — all challenges incl. drafts (admin only). */
export async function GET(request: NextRequest) {
  const guard = await guardAdmin(request, { mutation: false });
  if (!guard.ok) return guard.response;
  return jsonOk(await listAdminChallenges(), { headers });
}

/** POST /api/v1/admin/challenges — create a DRAFT challenge (+ private flag verifier). */
export async function POST(request: NextRequest) {
  const guard = await guardAdmin(request, { mutation: true });
  if (!guard.ok) return guard.response;
  const parsed = adminCreateSchema.safeParse(await readJson(request, 64_000));
  if (!parsed.success) {
    return jsonError(400, "invalid_body", "Invalid challenge fields.", z.flattenError(parsed.error).fieldErrors, { headers });
  }
  const { flag, ...fields } = parsed.data;
  const result = await saveAdminChallenge(guard.user.id, null, fields, flag);
  if (!result.ok) return jsonError(result.status, result.code, result.message, undefined, { headers });
  return jsonOk({ id: result.id }, { status: 201, headers });
}
