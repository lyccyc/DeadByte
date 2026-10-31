import { DEMO_CHALLENGES } from "@/data/demo-challenges";
import { REGIONS, type RegionSlug } from "@/config/regions";
import type { Challenge } from "@/lib/challenge-types";
import { filterChallenges, isPubliclyVisible, type ChallengeQuery } from "@/lib/challenge-filter";

export type { ChallengeQuery };

/**
 * Read-only challenge catalogue.
 *
 * Phase 1 serves the demo catalogue. Phase 2 replaces the data source with a
 * Supabase query that applies the SAME rule: only `published` challenges are
 * ever returned to public callers.
 */

export function listPublishedChallenges(query: ChallengeQuery = {}): Challenge[] {
  return filterChallenges(DEMO_CHALLENGES, query);
}

export function getPublishedChallenge(slug: string): Challenge | undefined {
  return DEMO_CHALLENGES.find((c) => c.slug === slug && isPubliclyVisible(c));
}

export function countPublishedByRegion(): Record<RegionSlug, number> {
  const counts = Object.fromEntries(REGIONS.map((r) => [r.slug, 0])) as Record<RegionSlug, number>;
  for (const c of DEMO_CHALLENGES) if (isPubliclyVisible(c)) counts[c.region] += 1;
  return counts;
}
