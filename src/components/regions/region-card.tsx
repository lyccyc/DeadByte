import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Region } from "@/config/regions";
import { RegionIcon } from "./region-icon";

export function RegionCard({ region, count }: { region: Region; count: number }) {
  return (
    <Link
      href={`/regions/${region.slug}`}
      data-testid={`region-card-${region.slug}`}
      className="group flex min-h-24 items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-[color:var(--region-accent)] hover:bg-surface-elevated"
      style={{ ["--region-accent" as string]: region.accent }}
    >
      <span
        className="flex size-12 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: `${region.accent}66`, backgroundColor: `${region.accent}14`, color: region.accent }}
      >
        <RegionIcon icon={region.icon} className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[11px] uppercase tracking-widest text-muted">
          {String(region.sortOrder).padStart(2, "0")} · {region.name}
        </span>
        <span className="block text-base font-semibold text-fg">{region.forensicDomain}</span>
        <span className="block truncate text-sm text-muted">{region.tagline}</span>
      </span>
      <span className="flex flex-col items-end gap-1 font-mono text-xs text-muted">
        <span>
          <span className="text-fg">{count}</span> case{count === 1 ? "" : "s"}
        </span>
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
