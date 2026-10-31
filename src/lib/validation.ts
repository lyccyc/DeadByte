import { z } from "zod";
import { REGION_SLUGS } from "@/config/regions";
import { DIFFICULTIES, SORT_OPTIONS } from "@/lib/challenge-types";

/** Optional enum that treats empty strings and unknown values as "not set" for lenient URL parsing. */
const lenientEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((v) => ((values as readonly string[]).includes(v ?? "") ? (v as T[number]) : undefined));

/** Lenient parser for UI query strings (bad values are ignored, not errors). */
export const challengeFilterSchema = z.object({
  region: lenientEnum(REGION_SLUGS),
  difficulty: lenientEnum(DIFFICULTIES),
  sort: lenientEnum(SORT_OPTIONS),
  q: z
    .string()
    .optional()
    .transform((v) => v?.trim().slice(0, 100) || undefined),
});

/** Strict parser for the public API: unknown values are rejected with 400. */
export const challengeApiQuerySchema = z.object({
  region: z.enum(REGION_SLUGS).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  sort: z.enum(SORT_OPTIONS).optional(),
  q: z.string().trim().max(100).optional(),
});

export function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of params) if (!(key in out)) out[key] = value;
  return out;
}
