import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CheckCircle2, Download, FileArchive, Lock, ShieldAlert } from "lucide-react";
import { getRegionOrThrow } from "@/config/regions";
import { getPublishedChallenge, listPublishedChallenges } from "@/lib/challenges";
import { formatBytes, formatDate } from "@/lib/format";
import { getConfigState } from "@/lib/app-config";
import { RegionIcon } from "@/components/regions/region-icon";
import { DifficultyBadge } from "@/components/challenges/difficulty-badge";
import { FlagForm, FlagFormLocked } from "@/components/challenges/flag-form";
import { getSessionUser } from "@/server/auth";
import { getMySolves } from "@/server/progress";
import type { Challenge } from "@/lib/challenge-types";
import { CopyButton } from "@/components/ui/copy-button";
import { DemoTag } from "@/components/ui/demo-tag";
import { Notice } from "@/components/ui/notice";

/** Placeholder keeps the build valid when no challenge is published yet (Cache Components needs ≥1 param). */
const NO_CHALLENGES = "__no-published-challenges__";

export async function generateStaticParams() {
  const slugs = (await listPublishedChallenges()).map((c) => ({ slug: c.slug }));
  return slugs.length > 0 ? slugs : [{ slug: NO_CHALLENGES }];
}

async function PlayerSolveStatus({ challenge }: { challenge: Challenge }) {
  if (!getConfigState().accountsEnabled) return <>Not tracked</>;
  const solves = await getMySolves();
  if (!solves) return <>Sign in to track</>;
  const solve = solves.find((s) => s.challengeId === challenge.id);
  return solve ? (
    <span className="inline-flex items-center gap-1 text-success" data-testid="solved-status">
      <CheckCircle2 className="size-3.5" aria-hidden="true" /> Solved
    </span>
  ) : (
    <span className="text-fg">Unsolved</span>
  );
}

async function PlayerFlagPanel({ challenge }: { challenge: Challenge }) {
  if (!getConfigState().accountsEnabled || challenge.isDemo) {
    return <FlagFormLocked reason="Unavailable in demo mode: server-side flag verification and accounts are not connected. Nothing is submitted." />;
  }
  const user = await getSessionUser();
  if (!user) {
    return (
      <FlagFormLocked
        reason="Sign in to submit flags. Flags are verified on the server."
        action={{ href: `/login?next=${encodeURIComponent(`/challenges/${challenge.slug}`)}`, label: "SIGN IN TO SUBMIT" }}
      />
    );
  }
  const solve = (await getMySolves())?.find((s) => s.challengeId === challenge.id);
  if (solve) {
    return (
      <section aria-labelledby="flag-title" className="rounded-xl border border-success/40 bg-success/10 p-5" data-testid="solved-panel">
        <h2 id="flag-title" className="flex items-center gap-2 font-semibold text-success">
          <CheckCircle2 className="size-4" aria-hidden="true" /> Solved
        </h2>
        <p className="mt-2 text-sm text-fg">
          You recovered this flag on {formatDate(solve.solvedAt)} and were awarded{" "}
          <span className="font-mono font-semibold">{solve.pointsAwarded}</span> points.
        </p>
        <p className="mt-2 text-xs text-muted">Points are awarded once. Repeat submissions never add more.</p>
      </section>
    );
  }
  return <FlagForm challengeId={challenge.id} />;
}

export async function generateMetadata({ params }: PageProps<"/challenges/[slug]">): Promise<Metadata> {
  const challenge = await getPublishedChallenge((await params).slug);
  if (!challenge) return { title: "Challenge not found", robots: { index: false } };
  return { title: challenge.title, description: challenge.summary };
}

export default async function ChallengePage({ params }: PageProps<"/challenges/[slug]">) {
  const { slug } = await params;
  const challenge = await getPublishedChallenge(slug);
  if (!challenge) notFound();

  const region = getRegionOrThrow(challenge.region);
  const { accountsEnabled, evidenceDownloadsEnabled } = getConfigState();
  const downloadNote = evidenceDownloadsEnabled
    ? "Sign in to request a short-lived download link."
    : accountsEnabled
      ? "Evidence downloads are not connected yet: the private evidence storage (Cloudflare R2) is still being set up."
      : "Downloads are unavailable in demo mode: no evidence is stored and sign-in is not connected.";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" style={{ ["--region-accent" as string]: region.accent }}>
      <nav aria-label="Breadcrumb" className="font-mono text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/challenges" className="inline-flex items-center gap-1 hover:text-fg">
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Challenges
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/regions/${region.slug}`} className="hover:text-fg">
              {region.name}
            </Link>
          </li>
        </ol>
      </nav>

      <header className="mt-6">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]" style={{ color: region.accent }}>
          <RegionIcon icon={region.icon} className="size-4" />
          {region.name} · {region.forensicDomain}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">{challenge.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {challenge.isDemo ? <DemoTag label="Demo briefing" /> : null}
          {challenge.isSample ? <DemoTag label="Sample · testing only" /> : null}
          <DifficultyBadge difficulty={challenge.difficulty} />
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-muted">
            {challenge.category}
          </span>
        </div>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-8">
          <section aria-labelledby="brief-title">
            <h2 id="brief-title" className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
              Case briefing
            </h2>
            <div className="mt-3 space-y-4 text-base leading-relaxed text-fg/90">
              {challenge.description.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {challenge.tags.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
                {challenge.tags.map((t) => (
                  <li key={t} className="rounded border border-border px-2 py-0.5 font-mono text-[11px] text-muted">
                    #{t.replace(/\s+/g, "-")}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section aria-labelledby="evidence-title">
            <h2 id="evidence-title" className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
              Evidence
            </h2>
            {challenge.evidence.length === 0 ? (
              <p className="mt-3 text-sm text-muted">This case has no downloadable evidence.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {challenge.evidence.map((file) => {
                  const uploaded = file.status === "verified";
                  return (
                    <li key={file.id} className="rounded-xl border border-border bg-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <FileArchive className="mt-0.5 size-5 text-muted" aria-hidden="true" />
                          <div>
                            <p className="font-mono text-sm text-fg">{file.displayName}</p>
                            <p className="font-mono text-xs text-muted">
                              {uploaded ? formatBytes(file.sizeBytes) : `~${formatBytes(file.sizeBytes)} planned · not uploaded`}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 font-mono text-xs tracking-wider text-muted disabled:cursor-not-allowed"
                          aria-describedby={`dl-${file.id}`}
                        >
                          <Lock className="size-3.5" aria-hidden="true" />
                          <Download className="size-3.5" aria-hidden="true" />
                          DOWNLOAD EVIDENCE
                        </button>
                      </div>
                      <dl className="mt-3 grid gap-1 border-t border-border pt-3 font-mono text-xs">
                        <dt className="text-muted">SHA-256</dt>
                        <dd className="flex flex-wrap items-center gap-2 break-all text-fg">
                          {file.sha256 ? (
                            <>
                              {file.sha256}
                              <CopyButton value={file.sha256} label={`Copy SHA-256 of ${file.displayName}`} />
                            </>
                          ) : (
                            <span className="text-muted">Published after the evidence is uploaded and verified.</span>
                          )}
                        </dd>
                      </dl>
                      <p id={`dl-${file.id}`} className="mt-2 text-xs text-muted">
                        {downloadNote}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <Notice title="Handle evidence safely">
            Forensic evidence can contain live malware samples or sensitive-looking artifacts. Analyse it in an isolated
            environment, verify the SHA-256 before use, and never execute unknown binaries on your host.
          </Notice>
        </div>

        <aside className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-5 font-mono text-xs">
            <div>
              <dt className="text-muted">Points</dt>
              <dd className="mt-1 text-2xl font-semibold text-fg">{challenge.points}</dd>
            </div>
            <div>
              <dt className="text-muted">Status</dt>
              <dd className="mt-1 text-sm text-muted">
                <Suspense fallback="…">
                  <PlayerSolveStatus challenge={challenge} />
                </Suspense>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Published</dt>
              <dd className="mt-1 text-sm text-fg">{formatDate(challenge.publishedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">Flag format</dt>
              <dd className="mt-1 text-sm text-fg">DEADBYTE{"{...}"}</dd>
            </div>
            {challenge.solveCount != null ? (
              <div>
                <dt className="text-muted">Solves</dt>
                <dd className="mt-1 text-sm text-fg">{challenge.solveCount}</dd>
              </div>
            ) : null}
          </dl>
          <Suspense fallback={<FlagFormLocked reason="Checking your session…" />}>
            <PlayerFlagPanel challenge={challenge} />
          </Suspense>
          <p className="flex items-start gap-2 text-xs text-muted">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Flags are never checked in your browser. Repeat correct submissions never award extra points.
          </p>
        </aside>
      </div>
    </div>
  );
}
