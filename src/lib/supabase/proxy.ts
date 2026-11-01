import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on navigation (runs in src/proxy.ts).
 * This is an optimistic session refresh only — authorization is always
 * re-checked next to the data in Server Components and Route Handlers.
 */
export async function refreshSupabaseSession(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return response;
  // Skip the network round trip entirely for visitors without auth cookies.
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return response;

  let current = response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        const next = NextResponse.next({ request });
        // Preserve a rewrite/redirect decided before the refresh.
        for (const [k, v] of current.headers) if (k !== "set-cookie") next.headers.set(k, v);
        current = next;
        for (const { name, value, options } of cookiesToSet) current.cookies.set(name, value, options);
      },
    },
  });
  // getClaims() validates the JWT and refreshes an expired session if needed.
  await supabase.auth.getClaims();
  return current;
}
