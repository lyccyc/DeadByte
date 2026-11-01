/** Only same-site relative paths are allowed as post-auth destinations (prevents open redirects). */
export function safeNextPath(value: unknown, fallback = "/profile"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value) || value.length > 512) return fallback;
  return value;
}
