import { z } from "zod";
import { REGION_SLUGS } from "@/config/regions";
import { DIFFICULTIES } from "@/lib/challenge-types";

/** Client-safe validation for admin challenge forms and the admin API. */

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_ADMIN_FLAG_LENGTH = 256;

export const adminChallengeFieldsSchema = z
  .object({
    slug: z.string().trim().min(1).max(80).regex(SLUG_PATTERN, "Use lowercase letters, digits and single hyphens."),
    region: z.enum(REGION_SLUGS),
    title: z.string().trim().min(1).max(120),
    summary: z.string().trim().max(300).default(""),
    description: z.string().trim().max(20_000).default(""),
    category: z.string().trim().max(60).default(""),
    tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
    difficulty: z.enum(DIFFICULTIES),
    points: z.coerce.number().int().min(1).max(10_000),
    requiresEvidence: z.boolean().default(true),
    isSample: z.boolean().default(false),
  })
  .strict();

export type AdminChallengeFields = z.infer<typeof adminChallengeFieldsSchema>;

/** `flag` is optional: omit (or send empty) to keep the current flag. */
export const adminCreateSchema = adminChallengeFieldsSchema.extend({
  flag: z.string().max(MAX_ADMIN_FLAG_LENGTH).optional(),
});

export const adminPatchSchema = adminChallengeFieldsSchema.partial().extend({
  flag: z.string().max(MAX_ADMIN_FLAG_LENGTH).optional(),
});

/** Comma-separated tag input → normalised unique tags. */
export function parseTags(input: string): string[] {
  return [...new Set(input.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
}
