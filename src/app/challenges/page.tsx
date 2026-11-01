import type { Metadata } from "next";
import { Suspense } from "react";
import { listPublishedChallenges } from "@/lib/challenges";
import type { Challenge } from "@/lib/challenge-types";
import { getConfigState } from "@/lib/app-config";
import { getCatalogue } from "@/server/catalogue";
import { getMySolves } from "@/server/progress";
import { ChallengeBrowser } from "@/components/challenges/challenge-browser";
import { DemoTag } from "@/components/ui/demo-tag";

export const metadata: Metadata = {
  title: "Challenges",
  description: "Browse published DeadByte digital forensics challenges by region, difficulty and points.",
};

function BrowserFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-20 animate-pulse rounded-xl border border-border bg-surface/60" />
      <p className="font-mono text-xs text-muted">[ ACCESSING DIGITAL EVIDENCE... ]</p>
    </div>
  );
}

/** Reads the session (solved state), so it streams in behind Suspense. */
async function PersonalizedBrowser({ challenges }: { challenges: Challenge[] }) {
  const solves = getConfigState().accountsEnabled ? await getMySolves() : null;
  return <ChallengeBrowser challenges={challenges} solvedIds={solves?.map((s) => s.challengeId)} />;
}

export default async function ChallengesPage() {
  const [challenges, { source }] = await Promise.all([listPublishedChallenges(), getCatalogue()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Evidence Archive</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">All challenges</h1>
      {source === "demo" ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-muted">
          <DemoTag label="Demo catalogue" /> Preview briefings only. Evidence files and flag verification are not connected yet.
        </p>
      ) : (
        <p className="mt-2 text-muted">Published cases. Sign in to submit flags; points are awarded once per case.</p>
      )}
      <div className="mt-8">
        <Suspense fallback={<BrowserFallback />}>
          <PersonalizedBrowser challenges={challenges} />
        </Suspense>
      </div>
    </div>
  );
}
