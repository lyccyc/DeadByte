import { PRIVATE_NO_STORE, jsonError, jsonOk } from "@/lib/api";
import { getConfigState } from "@/lib/app-config";
import { getMyProgress } from "@/server/progress";

/** GET /api/v1/me/progress — the caller's own solves and per-region stats. */
export async function GET() {
  const headers = PRIVATE_NO_STORE;
  if (!getConfigState().accountsEnabled) return jsonError(503, "not_configured", "Accounts are not configured.", undefined, { headers });
  const progress = await getMyProgress();
  if (!progress) return jsonError(401, "unauthenticated", "Sign in required.", undefined, { headers });
  return jsonOk(
    {
      ...progress,
      recent: progress.recent.map(({ solve, challenge }) => ({
        ...solve,
        challenge: challenge ? { slug: challenge.slug, title: challenge.title, region: challenge.region } : null,
      })),
    },
    { headers },
  );
}
