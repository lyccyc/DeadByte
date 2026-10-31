import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { getLeaderboardPage } from "@/server/leaderboard";

const querySchema = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1) });

/** GET /api/v1/leaderboard?page= — public all-time aggregates (no emails, no raw activity). */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({ page: request.nextUrl.searchParams.get("page") ?? undefined });
  if (!parsed.success) return jsonError(400, "invalid_query", "Invalid page.");
  const board = await getLeaderboardPage(parsed.data.page);
  if (!board.available) return jsonError(503, "unavailable", "Leaderboard is not available.");
  return jsonOk(board);
}
