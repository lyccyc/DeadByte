import { NextResponse, type NextRequest } from "next/server";
import { REGION_SLUGS } from "@/config/regions";
import { DEMO_CHALLENGES } from "@/data/demo-challenges";
import { getConfigState } from "@/lib/app-config";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

/**
 * 1. Returns a real HTTP 404 for unknown region slugs (and, in demo mode,
 *    unknown challenge slugs). Pages stream with Cache Components, so
 *    `notFound()` inside a page can only produce a "soft" 404 for paths that
 *    were not prerendered. With the database catalogue, unknown challenge
 *    slugs render the not-found UI with a soft 404 (noindex) instead of
 *    paying a database round trip here on every challenge view.
 * 2. Refreshes the Supabase auth session cookie when accounts are configured.
 */
const REGIONS = new Set<string>(REGION_SLUGS);
const DEMO_PUBLISHED = new Set(DEMO_CHALLENGES.filter((c) => c.status === "published").map((c) => c.slug));
const NOT_FOUND_PATH = "/_deadbyte-not-found";

function isUnknownSlug(pathname: string, accountsEnabled: boolean): boolean {
  const parts = pathname.split("/");
  if (parts.length !== 3 || !parts[2]) return false;
  const [, section, slug] = parts;
  if (section === "regions") return !REGIONS.has(slug);
  if (section === "challenges" && !accountsEnabled) return !DEMO_PUBLISHED.has(slug);
  return false;
}

export async function proxy(request: NextRequest) {
  const { accountsEnabled } = getConfigState();
  if (isUnknownSlug(request.nextUrl.pathname, accountsEnabled)) {
    // Rewrite to a path no route matches, which renders app/not-found.tsx with status 404.
    return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url));
  }
  const response = NextResponse.next({ request });
  return accountsEnabled ? refreshSupabaseSession(request, response) : response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|maps/|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
