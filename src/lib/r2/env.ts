/**
 * R2 environment parsing shared by the server, the config-state banner and the
 * operator CLI. No SDK imports and no I/O; never import from client components
 * (it reads secret variables).
 */

export interface R2Env {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

type Env = Record<string, string | undefined>;

/** Secret-free validation problems for the R2 variables (empty when valid or entirely unset). */
export function r2EnvProblems(env: Env = process.env): string[] {
  const v = (k: string) => env[k]?.trim() ?? "";
  const keys = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];
  const missing = keys.filter((k) => !v(k));
  if (missing.length === keys.length) return [];
  const problems: string[] = [];
  if (missing.length) problems.push(`Missing: ${missing.join(", ")}`);
  if (v("R2_ACCOUNT_ID") && !/^[0-9a-f]{32}$/i.test(v("R2_ACCOUNT_ID"))) problems.push("R2_ACCOUNT_ID must be the 32-character Cloudflare account id");
  if (v("R2_BUCKET_NAME") && !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(v("R2_BUCKET_NAME"))) problems.push("R2_BUCKET_NAME is not a valid bucket name");
  return problems;
}

export function readR2Env(env: Env = process.env): R2Env {
  const problems = r2EnvProblems(env);
  const accountId = env.R2_ACCOUNT_ID?.trim();
  if (problems.length || !accountId) throw new Error(`R2 is not configured: ${problems.join("; ") || "R2_* variables are not set"}`);
  return {
    accountId,
    accessKeyId: env.R2_ACCESS_KEY_ID!.trim(),
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!.trim(),
    bucket: env.R2_BUCKET_NAME!.trim(),
  };
}
