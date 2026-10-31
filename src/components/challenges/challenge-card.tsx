import Link from "next/link";
import { HardDriveDownload } from "lucide-react";
import { getRegionOrThrow } from "@/config/regions";
import type { Challenge } from "@/lib/challenge-types";
import { formatBytes } from "@/lib/format";
import { RegionIcon } from "@/components/regions/region-icon";
import { DemoTag } from "@/components/ui/demo-tag";
import { DifficultyBadge } from "./difficulty-badge";

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const region = getRegionOrThrow(challenge.region);
  const totalBytes = challenge.evidence.reduce((sum, f) => sum + f.sizeBytes, 0);
  const allUploaded = challenge.evidence.length > 0 && challenge.evidence.every((f) => f.status === "verified");

  return (
    <article
      className="group relative flex h-full flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-[color:var(--region-accent)] focus-within:border-[color:var(--region-accent)]"
      style={{ ["--region-accent" as string]: region.accent }}
      data-testid="challenge-card"
    >
      <div className="flex items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-wider">
        <span className="inline-flex items-center gap-1.5" style={{ color: region.accent }}>
          <RegionIcon icon={region.icon} className="size-3.5" />
          {region.name} · {region.forensicDomain}
        </span>
        {challenge.isDemo ? <DemoTag /> : null}
      </div>

      <h3 className="mt-3 text-lg font-semibold leading-snug">
        <Link href={`/challenges/${challenge.slug}`} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none">
          {challenge.title}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{challenge.summary}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DifficultyBadge difficulty={challenge.difficulty} />
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-muted">
          {challenge.category}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 font-mono text-xs">
        <div>
          <dt className="text-muted">Points</dt>
          <dd className="text-base font-semibold text-fg">{challenge.points}</dd>
        </div>
        <div>
          <dt className="text-muted">Evidence</dt>
          <dd className="flex items-center gap-1 text-fg">
            <HardDriveDownload className="size-3.5 text-muted" aria-hidden="true" />
            {challenge.evidence.length === 0 ? "None" : `${allUploaded ? "" : "~"}${formatBytes(totalBytes)}`}
            {!allUploaded && challenge.evidence.length > 0 ? <span className="sr-only">(planned size, not uploaded)</span> : null}
          </dd>
        </div>
      </dl>
    </article>
  );
}
