import "server-only";
import { REGIONS, type RegionSlug } from "@/config/regions";
import type { Challenge } from "@/lib/challenge-types";
import { filterChallenges, isPubliclyVisible, type ChallengeQuery } from "@/lib/challenge-filter";
import { getCatalogue } from "@/server/catalogue";

export type { ChallengeQuery };

/**
 * Read-only public challenge catalogue. Demo mode serves the demo catalogue;
 * configured mode serves published database challenges. Both apply the SAME
 * rule: only `published` challenges are ever returned to public callers.
 */

export async function listPublishedChallenges(query: ChallengeQuery = {}): Promise<Challenge[]> {
  const { challenges } = await getCatalogue();
  return filterChallenges(challenges, query);
}

export async function getPublishedChallenge(slug: string): Promise<Challenge | undefined> {
  const { challenges } = await getCatalogue();
  return challenges.find((c) => c.slug === slug && isPubliclyVisible(c));
}

export function countByRegion(challenges: readonly Challenge[]): Record<RegionSlug, number> {
  const counts = Object.fromEntries(REGIONS.map((r) => [r.slug, 0])) as Record<RegionSlug, number>;
  for (const c of challenges) if (isPubliclyVisible(c)) counts[c.region] += 1;
  return counts;
}

export async function countPublishedByRegion(): Promise<Record<RegionSlug, number>> {
  return countByRegion((await getCatalogue()).challenges);
}
