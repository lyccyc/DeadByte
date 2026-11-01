import type { NextRequest } from "next/server";
import { z } from "zod";
import { PRIVATE_NO_STORE, jsonError, jsonOk } from "@/lib/api";
import { getConfigState } from "@/lib/app-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth";

const querySchema = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1) });
const PAGE_SIZE = 50;

/** GET /api/v1/me/submissions?page= — the caller's own attempts (metadata only; flags are never stored). */
export async function GET(request: NextRequest) {
  const headers = PRIVATE_NO_STORE;
  if (!getConfigState().accountsEnabled) return jsonError(503, "not_configured", "Accounts are not configured.", undefined, { headers });
  const user = await getSessionUser();
  if (!user) return jsonError(401, "unauthenticated", "Sign in required.", undefined, { headers });
  const parsed = querySchema.safeParse({ page: request.nextUrl.searchParams.get("page") ?? undefined });
  if (!parsed.success) return jsonError(400, "invalid_query", "Invalid page.", undefined, { headers });

  const from = (parsed.data.page - 1) * PAGE_SIZE;
  const supabase = await createSupabaseServerClient();
  // RLS restricts rows to the caller; the explicit filter keeps the query indexed.
  const { data, error, count } = await supabase
    .from("submissions")
    .select("id, challenge_id, is_correct, submitted_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) return jsonError(500, "server_error", "Could not load submissions.", undefined, { headers });
  return jsonOk(
    {
      page: parsed.data.page,
      pageSize: PAGE_SIZE,
      total: count ?? 0,
      items: data.map((s) => ({ id: s.id, challengeId: s.challenge_id, correct: s.is_correct, submittedAt: s.submitted_at })),
    },
    { headers },
  );
}
