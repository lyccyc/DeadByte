import type { RegionSlug } from "@/config/regions";
import type { Challenge, Difficulty, SortOption } from "@/lib/challenge-types";

/** Pure, client-safe filtering. Only `published` challenges ever pass. */

export interface ChallengeQuery {
  region?: RegionSlug;
  difficulty?: Difficulty;
  q?: string;
  sort?: SortOption;
}

export function isPubliclyVisible(challenge: Pick<Challenge, "status">): boolean {
  return challenge.status === "published";
}

export function filterChallenges(
  source: readonly Challenge[],
  { region, difficulty, q, sort = "newest" }: ChallengeQuery = {},
): Challenge[] {
  const needle = q?.trim().toLowerCase() ?? "";
  const result = source.filter((c) => {
    if (!isPubliclyVisible(c)) return false;
    if (region && c.region !== region) return false;
    if (difficulty && c.difficulty !== difficulty) return false;
    if (needle) {
      const haystack = [c.title, c.summary, c.category, ...c.tags].join(" ").toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const byNewest = (a: Challenge, b: Challenge) =>
    (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || a.slug.localeCompare(b.slug);

  switch (sort) {
    case "points-desc":
      return result.sort((a, b) => b.points - a.points || byNewest(a, b));
    case "points-asc":
      return result.sort((a, b) => a.points - b.points || byNewest(a, b));
    default:
      return result.sort(byNewest);
  }
}
