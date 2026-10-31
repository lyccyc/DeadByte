import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/api";
import { getConfigState } from "@/lib/app-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** POST /auth/signout — ends the session (POST only, same-origin, so links cannot log users out). */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return new NextResponse("Cross-site request rejected.", { status: 403 });
  if (getConfigState().accountsEnabled) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
