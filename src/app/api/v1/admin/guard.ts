import type { NextRequest } from "next/server";
import { PRIVATE_NO_STORE, isSameOrigin, jsonError } from "@/lib/api";
import { checkAdmin, type SessionUser } from "@/server/auth";

/** Shared guard for every /api/v1/admin route: config, origin (mutations), session, admin role. */
export async function guardAdmin(
  request: NextRequest,
  { mutation }: { mutation: boolean },
): Promise<{ ok: true; user: SessionUser } | { ok: false; response: Response }> {
  if (mutation && !isSameOrigin(request)) {
    return { ok: false, response: jsonError(403, "bad_origin", "Cross-site request rejected.", undefined, { headers: PRIVATE_NO_STORE }) };
  }
  const check = await checkAdmin();
  if (!check.ok) {
    return { ok: false, response: jsonError(check.status, check.code, check.message, undefined, { headers: PRIVATE_NO_STORE }) };
  }
  return { ok: true, user: check.user };
}
