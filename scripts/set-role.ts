/**
 * Trusted operator CLI: assign the `admin` or `player` role to a user by email.
 *
 *   npm run set-role -- --email you@example.com --role admin
 *   npm run set-role -- you@example.com admin        (positional form also works)
 *
 * NOTE: the `--` after `set-role` is required with npm, otherwise npm swallows
 * the flags itself.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment
 * (loaded from .env.local). Roles live in the private `private.user_roles`
 * table and can only be changed through the service-only `svc_set_user_role`
 * function (audit-logged). The user must have signed up and confirmed their
 * email first.
 */
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    options: { email: { type: "string" }, role: { type: "string" } },
    allowPositionals: true,
  });

  const email = (values.email ?? positionals[0])?.trim().toLowerCase();
  const role = values.role ?? positionals[1] ?? "admin";
  if (!email || !email.includes("@") || (role !== "admin" && role !== "player")) {
    console.error("Usage: npm run set-role -- --email <email> --role <admin|player>");
    return 2;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (e.g. in .env.local).");
    return 2;
  }

  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  let userId: string | null = null;
  for (let page = 1; page <= 100 && !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error(`Could not list users: ${error.message}`);
      return 1;
    }
    const match = data.users.find((u: { id: string; email?: string }) => u.email?.toLowerCase() === email);
    userId = match?.id ?? null;
    if (data.users.length < 200) break;
  }
  if (!userId) {
    console.error(`No user with email ${email}. Register on the site and confirm the email first.`);
    return 1;
  }

  const { error } = await supabase.rpc("svc_set_user_role", { p_user_id: userId, p_role: role, p_actor: null });
  if (error) {
    console.error(
      error.code === "PGRST202"
        ? "The database migration has not been applied yet (svc_set_user_role is missing). See docs/database.md."
        : `Failed: ${error.code ?? ""} ${error.message}`,
    );
    return 1;
  }
  console.log(`Role for ${email} set to ${role}.`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
