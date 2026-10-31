import { NextResponse, type NextRequest } from "next/server";
import { REGION_SLUGS } from "@/config/regions";
import { DEMO_CHALLENGES } from "@/data/demo-challenges";

/**
 * Returns a real HTTP 404 for unknown region / challenge slugs.
 *
 * Pages stream with Cache Components, so `notFound()` inside a page can only
 * produce a "soft" 404 (200 + noindex) for paths that were not prerendered.
 * Checking the slug here, before rendering, preserves the 404 status code.
 *
 * Phase 2: challenge slugs come from the database; replace the demo lookup
 * with a fast indexed existence check (or drop it and accept soft 404s).
 */
const REGIONS = new Set<string>(REGION_SLUGS);
const PUBLISHED_CHALLENGES = new Set(DEMO_CHALLENGES.filter((c) => c.status === "published").map((c) => c.slug));

export function proxy(request: NextRequest) {
  const [, section, slug] = request.nextUrl.pathname.split("/");
  const known = section === "regions" ? REGIONS.has(slug) : PUBLISHED_CHALLENGES.has(slug);
  if (known) return NextResponse.next();
  // Rewrite to a path no route matches, which renders app/not-found.tsx with status 404.
  return NextResponse.rewrite(new URL("/_deadbyte-not-found", request.url));
}

export const config = {
  matcher: ["/regions/:slug", "/challenges/:slug"],
};
