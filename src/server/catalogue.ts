import "server-only";
import { RETRY_SOON } from "@/server/cache-profiles";
import { cacheLife, cacheTag } from "next/cache";
import { isRegionSlug } from "@/config/regions";
import { DEMO_CHALLENGES } from "@/data/demo-challenges";
import { getConfigState } from "@/lib/app-config";
import type { Challenge, Difficulty } from "@/lib/challenge-types";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const CATALOGUE_TAG = "catalogue";

export type CatalogueSource = "demo" | "database";
/** `schema_missing`: migrations not applied. `unavailable`: any other DB/API failure. */
export type CatalogueError = "schema_missing" | "unavailable";

export interface Catalogue {
  source: CatalogueSource;
  challenges: Challenge[];
  error: CatalogueError | null;
}

interface ChallengeRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: Difficulty;
  points: number;
  status: "published";
  is_sample: boolean;
  published_at: string;
  regions: { slug: string } | null;
  evidence_files: { id: string; display_name: string; size_bytes: number; sha256: string }[];
}

/** Description text → paragraphs (blank-line separated). */
export function toParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function mapChallengeRow(row: ChallengeRow, solveCounts: Map<string, number>): Challenge | null {
  const region = row.regions?.slug;
  if (!region || !isRegionSlug(region)) return null;
  return {
    id: row.id,
    slug: row.slug,
    region,
    title: row.title,
    summary: row.summary,
    description: toParagraphs(row.description),
    category: row.category,
    difficulty: row.difficulty,
    points: row.points,
    status: "published",
    publishedAt: row.published_at,
    tags: row.tags ?? [],
    evidence: (row.evidence_files ?? [])
      .map((f) => ({
        id: f.id,
        displayName: f.display_name,
        sizeBytes: Number(f.size_bytes),
        sha256: f.sha256,
        status: "verified" as const,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    isDemo: false,
    isSample: row.is_sample,
    solveCount: solveCounts.get(row.id) ?? 0,
  };
}

function classify(error: { code?: string; message?: string } | null): CatalogueError {
  // PGRST205: table not in schema cache; 42P01: undefined table; PGRST202: function not found.
  return error && ["PGRST205", "PGRST202", "42P01", "42883"].includes(error.code ?? "") ? "schema_missing" : "unavailable";
}

async function loadDatabaseCatalogue(): Promise<Catalogue> {
  const supabase = createSupabasePublicClient();
  // Public (anon) read under RLS: only published challenges and their active,
  // verified evidence metadata. object_key is not selectable by anon at all.
  const { data, error } = await supabase
    .from("challenges")
    .select(
      "id, slug, title, summary, description, category, tags, difficulty, points, status, is_sample, published_at, regions(slug), evidence_files(id, display_name, size_bytes, sha256)",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[catalogue] challenge query failed", { code: error.code, message: error.message });
    return { source: "database", challenges: [], error: classify(error) };
  }

  const solveCounts = new Map<string, number>();
  const counts = await createSupabaseAdminClient().rpc("svc_solve_counts");
  if (counts.error) {
    console.error("[catalogue] solve count query failed", { code: counts.error.code, message: counts.error.message });
  } else {
    for (const r of counts.data as { challenge_id: string; solve_count: number }[]) {
      solveCounts.set(r.challenge_id, Number(r.solve_count));
    }
  }

  const challenges = (data as unknown as ChallengeRow[])
    .map((row) => mapChallengeRow(row, solveCounts))
    .filter((c): c is Challenge => c !== null);
  return { source: "database", challenges, error: null };
}

/**
 * The public catalogue. Cached and shared between visitors (it contains only
 * public data); invalidated by tag when admins publish/edit or a solve lands.
 */
export async function getCatalogue(): Promise<Catalogue> {
  "use cache";
  cacheTag(CATALOGUE_TAG);

  if (!getConfigState().accountsEnabled) {
    cacheLife("max");
    return { source: "demo", challenges: [...DEMO_CHALLENGES], error: null };
  }

  try {
    const catalogue = await loadDatabaseCatalogue();
    // Retry soon after a failure instead of caching an outage for minutes.
    if (catalogue.error) cacheLife(RETRY_SOON);
    else cacheLife("minutes");
    return catalogue;
  } catch (err) {
    console.error("[catalogue] unexpected failure", err instanceof Error ? err.message : err);
    cacheLife(RETRY_SOON);
    return { source: "database", challenges: [], error: "unavailable" };
  }
}
