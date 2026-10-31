import "server-only";
import { REGIONS, type RegionSlug } from "@/config/regions";
import type { Challenge, SolveRecord } from "@/lib/challenge-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/server/auth";
import { getCatalogue } from "@/server/catalogue";

/**
 * The signed-in player's own solves, read with THEIR session (RLS: own rows only).
 * Returns null when signed out.
 */
export async function getMySolves(): Promise<SolveRecord[] | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("solves")
    .select("challenge_id, points_awarded, solved_at")
    .eq("user_id", user.id)
    .order("solved_at", { ascending: false });
  if (error) {
    console.error("[progress] solves query failed", { code: error.code });
    return [];
  }
  return data.map((r) => ({ challengeId: r.challenge_id, pointsAwarded: r.points_awarded, solvedAt: r.solved_at }));
}

export interface RegionProgress {
  region: RegionSlug;
  solved: number;
  total: number;
}

export interface MyProgress {
  totalPoints: number;
  solvedCount: number;
  rank: number | null;
  totalPlayers: number;
  regions: RegionProgress[];
  /** Most recent first; challenge is null if it is no longer published. */
  recent: { solve: SolveRecord; challenge: Challenge | null }[];
}

export function summarizeProgress(solves: SolveRecord[], published: Challenge[]): Omit<MyProgress, "rank" | "totalPlayers"> {
  const byId = new Map(published.map((c) => [c.id, c]));
  const solvedIds = new Set(solves.map((s) => s.challengeId));
  return {
    // Same source of truth as the leaderboard: every awarded solve counts,
    // even if its challenge was archived later.
    totalPoints: solves.reduce((sum, s) => sum + s.pointsAwarded, 0),
    solvedCount: solves.length,
    regions: REGIONS.map((r) => {
      const inRegion = published.filter((c) => c.region === r.slug);
      return { region: r.slug, total: inRegion.length, solved: inRegion.filter((c) => solvedIds.has(c.id)).length };
    }),
    recent: solves.slice(0, 10).map((solve) => ({ solve, challenge: byId.get(solve.challengeId) ?? null })),
  };
}

export async function getMyProgress(): Promise<MyProgress | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const [solves, catalogue, rank] = await Promise.all([
    getMySolves(),
    getCatalogue(),
    createSupabaseAdminClient().rpc("svc_user_rank", { p_user_id: user.id }),
  ]);
  const row = (rank.data as { rank: number; total_count: number }[] | null)?.[0];
  return {
    ...summarizeProgress(solves ?? [], catalogue.challenges),
    rank: row ? Number(row.rank) : null,
    totalPlayers: row ? Number(row.total_count) : 0,
  };
}
