import { NextResponse, type NextRequest } from "next/server";
import type { Challenge } from "@/lib/challenge-types";
import { getConfigState } from "@/lib/app-config";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ mode: getConfigState().accountsEnabled ? "configured" : "demo", data }, init);
}

export function jsonError(status: number, code: string, message: string, details?: unknown, init?: ResponseInit) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { ...init, status });
}

/** Never let user-specific API responses be cached by shared caches. */
export const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * CSRF defence-in-depth for cookie-authenticated mutations: browsers always
 * send `Origin` on cross-site POST/PATCH; require it to match this host.
 * (Supabase auth cookies are also SameSite=Lax.) Non-browser clients that send
 * no Origin header are allowed — they cannot carry a victim's cookies.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Parses a JSON body of at most `maxBytes`; returns undefined when invalid. */
export async function readJson(request: NextRequest, maxBytes = 16_384): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

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
    isSample: c.isSample ?? false,
    solveCount: c.solveCount ?? null,
    evidence: c.evidence.map((f) => ({
      id: f.id,
      displayName: f.displayName,
      sizeBytes: f.sizeBytes,
      sha256: f.sha256,
      status: f.status,
    })),
  };
}
