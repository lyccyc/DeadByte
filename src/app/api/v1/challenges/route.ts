import type { NextRequest } from "next/server";
import { z } from "zod";
import { listPublishedChallenges } from "@/lib/challenges";
import { challengeApiQuerySchema, searchParamsToObject } from "@/lib/validation";
import { jsonError, jsonOk, toPublicChallenge } from "@/lib/api";

/** GET /api/v1/challenges?region=&difficulty=&q=&sort= — published challenges only. */
export function GET(request: NextRequest) {
  const parsed = challengeApiQuerySchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!parsed.success) {
    return jsonError(400, "invalid_query", "Invalid query parameters.", z.flattenError(parsed.error).fieldErrors);
  }
  return jsonOk(listPublishedChallenges(parsed.data).map(toPublicChallenge));
}
