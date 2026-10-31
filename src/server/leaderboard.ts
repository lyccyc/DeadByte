import "server-only";
import { RETRY_SOON } from "@/server/cache-profiles";
import { cacheLife, cacheTag } from "next/cache";
import { getConfigState } from "@/lib/app-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const LEADERBOARD_TAG = "leaderboard";
export const LEADERBOARD_PAGE_SIZE = 25;

/** Public leaderboard row: aggregate data and public username only. */
export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl: string | null;
  points: number;
  solvedCount: number;
  lastSolveAt: string;
}

export interface LeaderboardPage {
  available: boolean;
  entries: LeaderboardEntry[];
  page: number;
  pageSize: number;
  totalPlayers: number;
  totalPages: number;
}

interface Row {
  rank: number;
  username: string;
  avatar_url: string | null;
  points: number;
  solved_count: number;
  last_solve_at: string;
  total_count: number;
}

/**
 * All-time leaderboard (points desc, time score reached asc, username asc).
 * Shared cache is fine: it only holds public aggregates. Invalidated on solve.
 */
export async function getLeaderboardPage(page: number): Promise<LeaderboardPage> {
  "use cache";
  cacheTag(LEADERBOARD_TAG);
  const pageSize = LEADERBOARD_PAGE_SIZE;
  const safePage = Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
  const empty = { entries: [], page: safePage, pageSize, totalPlayers: 0, totalPages: 0 };

  if (!getConfigState().accountsEnabled) {
    cacheLife("max");
    return { available: false, ...empty };
  }

  const { data, error } = await createSupabaseAdminClient().rpc("svc_leaderboard", {
    p_limit: pageSize,
    p_offset: (safePage - 1) * pageSize,
  });
  if (error) {
    console.error("[leaderboard] query failed", { code: error.code, message: error.message });
    cacheLife(RETRY_SOON);
    return { available: false, ...empty };
  }
  cacheLife("minutes");
  const rows = data as Row[];
  // total_count is a window count; an out-of-range page returns no rows, so fetch the total separately.
  let totalPlayers = rows[0] ? Number(rows[0].total_count) : 0;
  if (!rows[0] && safePage > 1) {
    const first = await createSupabaseAdminClient().rpc("svc_leaderboard", { p_limit: 1, p_offset: 0 });
    totalPlayers = first.data?.[0] ? Number((first.data as Row[])[0].total_count) : 0;
  }
  return {
    available: true,
    entries: rows.map((r) => ({
      rank: Number(r.rank),
      username: r.username,
      avatarUrl: r.avatar_url,
      points: Number(r.points),
      solvedCount: Number(r.solved_count),
      lastSolveAt: r.last_solve_at,
    })),
    page: safePage,
    pageSize,
    totalPlayers,
    totalPages: Math.ceil(totalPlayers / pageSize),
  };
}
