/**
 * Trusted operator CLI: assign the `admin` or `player` role to a user by email.
 *
 *   node --env-file-if-exists=.env.local --import tsx scripts/set-role.ts --email you@example.com --role admin
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment.
 * Roles live in the private `private.user_roles` table and can only be changed
 * through the service-only `svc_set_user_role` function (audit-logged).
 * The user must have signed up (and confirmed their email) first.
 */
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values } = parseArgs({
  options: { email: { type: "string" }, role: { type: "string", default: "admin" } },
});

const email = values.email?.trim().toLowerCase();
const role = values.role;
if (!email || (role !== "admin" && role !== "player")) {
  console.error("Usage: scripts/set-role.ts --email <email> --role <admin|player>");
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (e.g. in .env.local).");
  process.exit(2);
}

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserId(target: string): Promise<string | null> {
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

const userId = await findUserId(email);
if (!userId) {
  console.error(`No user with email ${email}. Register on the site first.`);
  process.exit(1);
}
const { error } = await supabase.rpc("svc_set_user_role", { p_user_id: userId, p_role: role, p_actor: null });
if (error) {
  console.error(`Failed: ${error.code ?? ""} ${error.message}`);
  process.exit(1);
}
console.log(`Role for ${email} set to ${role}.`);
