import type { NextRequest } from "next/server";
import { z } from "zod";
import { listPublishedChallenges } from "@/lib/challenges";
import { challengeApiQuerySchema, searchParamsToObject } from "@/lib/validation";
import { jsonError, jsonOk, toPublicChallenge } from "@/lib/api";

/** GET /api/v1/challenges?region=&difficulty=&q=&sort=&page= — published challenges only. */
export async function GET(request: NextRequest) {
  const parsed = challengeApiQuerySchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!parsed.success) {
    return jsonError(400, "invalid_query", "Invalid query parameters.", z.flattenError(parsed.error).fieldErrors);
  }
  const { page, pageSize, ...query } = parsed.data;
  const all = await listPublishedChallenges(query);
  const items = all.slice((page - 1) * pageSize, page * pageSize).map(toPublicChallenge);
  return jsonOk(items, {
    headers: { "X-Total-Count": String(all.length), "X-Page": String(page), "X-Page-Size": String(pageSize) },
  });
}
