const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Human-readable binary size, e.g. 2147483648 → "2.0 GB". Uses 1024 steps. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${UNITS[unit]}`;
}

/** Stable UTC date for display, e.g. "2026-10-20". Avoids locale/timezone hydration mismatches. */
export function formatDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}
