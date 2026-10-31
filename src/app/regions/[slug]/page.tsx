import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { REGIONS, getRegion } from "@/config/regions";
import { listPublishedChallenges } from "@/lib/challenges";
import { RegionIcon } from "@/components/regions/region-icon";
import { RegionChallengeList } from "@/components/regions/region-challenge-list";
import { getConfigState } from "@/lib/app-config";
import { getMySolves } from "@/server/progress";
import type { Challenge } from "@/lib/challenge-types";

/** Reads the session (solved state / progress), so it streams in behind Suspense. */
async function PersonalizedRegionList({ challenges }: { challenges: Challenge[] }) {
  const { accountsEnabled } = getConfigState();
  const solves = accountsEnabled ? await getMySolves() : null;
  return (
    <RegionChallengeList
      challenges={challenges}
      solvedIds={solves?.map((s) => s.challengeId)}
      signedOutHint={accountsEnabled ? "Sign in to track solved cases in this region." : undefined}
    />
  );
}

export function generateStaticParams() {
  return REGIONS.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: PageProps<"/regions/[slug]">): Promise<Metadata> {
  const region = getRegion((await params).slug);
  if (!region) return { title: "Region not found" };
  return { title: `${region.name} — ${region.forensicDomain}`, description: region.description };
}

export default async function RegionPage({ params }: PageProps<"/regions/[slug]">) {
  const { slug } = await params;
  const region = getRegion(slug);
  if (!region) notFound();

  const challenges = await listPublishedChallenges({ region: region.slug });
  const index = REGIONS.findIndex((r) => r.slug === region.slug);
  const prev = REGIONS[(index - 1 + REGIONS.length) % REGIONS.length];
  const next = REGIONS[(index + 1) % REGIONS.length];

  return (
    <div style={{ ["--region-accent" as string]: region.accent }}>
      <section className="relative overflow-hidden border-b border-border">
        <div className="cyber-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: region.accent }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <Link href="/#map" className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-fg">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Global Evidence Map
          </Link>
          <div className="mt-6 flex items-start gap-4">
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: `${region.accent}66`, backgroundColor: `${region.accent}14`, color: region.accent }}
            >
              <RegionIcon icon={region.icon} className="size-7" />
            </span>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em]" style={{ color: region.accent }}>
                Region {String(region.sortOrder).padStart(2, "0")} · {region.name}
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl" data-testid="region-domain">
                {region.forensicDomain}
              </h1>
              <p className="mt-2 font-mono text-sm text-fg">{region.tagline}</p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-muted">{region.description}</p>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Keywords">
            {region.keywords.map((k) => (
              <li key={k} className="rounded border border-border px-2 py-0.5 font-mono text-[11px] text-muted">
                #{k.replace(/\s+/g, "-")}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6" aria-labelledby="cases-title">
        <h2 id="cases-title" className="mb-6 text-xl font-semibold">
          Case files
        </h2>
        <Suspense fallback={<RegionChallengeList challenges={challenges} />}>
          <PersonalizedRegionList challenges={challenges} />
        </Suspense>
      </section>

      <nav aria-label="Other regions" className="mx-auto mt-16 flex max-w-6xl justify-between gap-4 px-4 font-mono text-sm sm:px-6">
        <Link href={`/regions/${prev.slug}`} className="text-muted hover:text-fg">
          ← {prev.name} <span className="hidden sm:inline">· {prev.forensicDomain}</span>
        </Link>
        <Link href={`/regions/${next.slug}`} className="text-right text-muted hover:text-fg">
          {next.name} <span className="hidden sm:inline">· {next.forensicDomain}</span> →
        </Link>
      </nav>
    </div>
  );
}
