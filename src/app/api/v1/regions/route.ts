import { REGIONS } from "@/config/regions";
import { countPublishedByRegion } from "@/lib/challenges";
import { jsonOk } from "@/lib/api";

/** GET /api/v1/regions — the seven regions with published challenge counts. */
export function GET() {
  const counts = countPublishedByRegion();
  return jsonOk(
    REGIONS.map((r) => ({
      slug: r.slug,
      name: r.name,
      forensicDomain: r.forensicDomain,
      sortOrder: r.sortOrder,
      publishedChallengeCount: counts[r.slug],
    })),
  );
}
