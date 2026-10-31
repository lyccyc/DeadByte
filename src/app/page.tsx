import Link from "next/link";
import { ArrowRight, Download, Flag, Search, Trophy } from "lucide-react";
import { REGIONS } from "@/config/regions";
import { countPublishedByRegion, listPublishedChallenges } from "@/lib/challenges";
import { WorldMap } from "@/components/map/world-map";
import { ExplorerPenguin } from "@/components/penguin/explorer-penguin";
import { RegionCard } from "@/components/regions/region-card";
import { ChallengeCard } from "@/components/challenges/challenge-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { DemoTag } from "@/components/ui/demo-tag";

export default function HomePage() {
  const counts = countPublishedByRegion();
  const featured = listPublishedChallenges({ sort: "newest" }).slice(0, 3);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border" aria-labelledby="hero-title">
        <div className="cyber-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="scanlines pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_1fr] md:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-xs tracking-[0.2em] text-accent">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
              CASE STATUS: INVESTIGATING
            </p>
            <h1 id="hero-title" className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Nothing Deleted.
              <br />
              <span className="glitch glitch-anim inline-block text-accent">Nothing Forgotten.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              A Digital Forensics CTF Expedition. Download forensic evidence, investigate it with your own tools, and recover
              the flag hidden across seven continents of digital forensics.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="#map"
                className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-mono text-sm font-semibold tracking-wider text-background transition-colors hover:bg-accent-hover"
                data-testid="cta-start"
              >
                START INVESTIGATION
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/challenges"
                className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 font-mono text-sm tracking-wider text-fg transition-colors hover:border-accent hover:text-accent"
              >
                Browse all cases
              </Link>
            </div>
            <p className="mt-6 font-mono text-xs text-muted caret">DEADBYTE // EVIDENCE ARCHIVE</p>
          </div>

          <div className="relative mx-auto w-48 sm:w-60 md:w-full md:max-w-xs">
            <div className="absolute inset-6 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
            <ExplorerPenguin className="relative h-auto w-full drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]" />
            <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-widest text-muted">
              Field agent · base camp Antarctica
            </p>
          </div>
        </div>
      </section>

      {/* MAP */}
      <section id="map" className="scroll-mt-20 mx-auto max-w-6xl px-4 pt-16 sm:px-6" aria-labelledby="map-title">
        <SectionHeading
          id="map-title"
          eyebrow="Global Evidence Map"
          title="Seven continents. Seven forensic disciplines."
          description="Every continent is a forensic domain. Pick a destination to open its case files."
        />
        <div className="mt-8 rounded-2xl border border-border bg-surface/50 p-2 sm:p-4">
          <WorldMap counts={counts} />
        </div>

        <h3 className="sr-only">All regions</h3>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Forensic regions">
          {REGIONS.map((region) => (
            <li key={region.slug} className="min-w-0">
              <RegionCard region={region} count={counts[region.slug]} />
            </li>
          ))}
        </ul>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6" aria-labelledby="how-title">
        <SectionHeading id="how-title" eyebrow="Field Manual" title="How an investigation works" />
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { icon: Search, title: "Pick a case", body: "Choose a region and a challenge that matches your skill level." },
            { icon: Download, title: "Acquire the evidence", body: "Download the evidence and verify its SHA-256. Analyse it locally with Volatility, Autopsy, Wireshark and friends." },
            { icon: Flag, title: "Submit the flag", body: "Recover the DEADBYTE{...} flag. It is verified server-side; points are awarded once, on your first solve." },
          ].map((step, i) => (
            <li key={step.title} className="rounded-xl border border-border bg-surface p-5">
              <p className="font-mono text-xs text-accent">STEP {String(i + 1).padStart(2, "0")}</p>
              <step.icon className="mt-3 size-6 text-fg" aria-hidden="true" />
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FEATURED */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6" aria-labelledby="featured-title">
        <SectionHeading
          id="featured-title"
          eyebrow="Recently Published"
          title="Latest case files"
          description={
            <span className="inline-flex flex-wrap items-center gap-2">
              <DemoTag label="Demo catalogue" /> Preview briefings — evidence and flags are not available yet.
            </span>
          }
          action={
            <Link href="/challenges" className="inline-flex items-center gap-1 font-mono text-sm text-accent hover:text-accent-hover">
              View all <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          }
        />
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {featured.map((c) => (
            <li key={c.id}>
              <ChallengeCard challenge={c} />
            </li>
          ))}
        </ul>
      </section>

      {/* LEADERBOARD PREVIEW (honest placeholder) */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6" aria-labelledby="lb-title">
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <Trophy className="mt-1 size-6 text-warning" aria-hidden="true" />
            <div>
              <h2 id="lb-title" className="text-xl font-semibold">All-time leaderboard</h2>
              <p className="mt-1 text-sm text-muted">
                Rankings appear here once accounts and server-side scoring are connected. No sample players are shown.
              </p>
            </div>
          </div>
          <Link href="/leaderboard" className="font-mono text-sm text-accent hover:text-accent-hover">
            Open leaderboard →
          </Link>
        </div>
      </section>
    </>
  );
}
