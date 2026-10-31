import { NextResponse } from "next/server";
import type { Challenge } from "@/lib/challenge-types";
import { getConfigState } from "@/lib/app-config";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ mode: getConfigState().mode === "configured" ? "configured" : "demo", data }, init);
}

export function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

/** Public projection of a challenge. Excludes status internals; never includes storage keys or flags. */
export function toPublicChallenge(c: Challenge) {
  return {
    id: c.id,
    slug: c.slug,
    region: c.region,
    title: c.title,
    summary: c.summary,
    description: c.description,
    category: c.category,
    difficulty: c.difficulty,
    points: c.points,
    publishedAt: c.publishedAt,
    tags: c.tags,
    isDemo: c.isDemo,
    evidence: c.evidence.map((f) => ({
      id: f.id,
      displayName: f.displayName,
      sizeBytes: f.sizeBytes,
      sha256: f.sha256,
      status: f.status,
    })),
  };
}
