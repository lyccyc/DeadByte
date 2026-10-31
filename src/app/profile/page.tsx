import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { REGIONS, getRegionOrThrow } from "@/config/regions";
import { getConfigState } from "@/lib/app-config";
import { formatDate } from "@/lib/format";
import { getViewer } from "@/server/auth";
import { getMyProgress } from "@/server/progress";
import { RegionIcon } from "@/components/regions/region-icon";
import { Notice } from "@/components/ui/notice";
import { UsernameForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

function Stat({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-fg" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

async function ProfileContent() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/profile");
  const progress = await getMyProgress();
  if (!progress) redirect("/login?next=/profile");

  return (
    <>
      <p className="mt-2 font-mono text-sm text-fg" data-testid="profile-username">
        {viewer.username}
        {viewer.role === "admin" ? <span className="ml-2 text-warning">· admin</span> : null}
      </p>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Total points" value={progress.totalPoints} testId="profile-points" />
        <Stat label="Solved cases" value={progress.solvedCount} testId="profile-solved" />
        <Stat label="Rank" value={progress.rank ? `#${progress.rank} of ${progress.totalPlayers}` : "Unranked"} />
      </dl>

      <h2 className="mt-10 font-mono text-xs uppercase tracking-[0.25em] text-muted">Region progress</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Region progress">
        {progress.regions.map((p) => {
          const r = getRegionOrThrow(p.region);
          const pct = p.total === 0 ? 0 : Math.round((p.solved / p.total) * 100);
          return (
            <li key={r.slug} className="rounded-xl border border-border bg-surface p-4" data-testid={`progress-${r.slug}`}>
              <Link href={`/regions/${r.slug}`} className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider hover:underline" style={{ color: r.accent }}>
                <RegionIcon icon={r.icon} className="size-3.5" /> {r.name}
              </Link>
              <p className="mt-1 text-sm font-semibold">{r.forensicDomain}</p>
              <p className="mt-3 font-mono text-xs text-muted">
                {p.solved}/{p.total} solved
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-elevated" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.forensicDomain} progress`}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: r.accent }} />
              </div>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 font-mono text-xs uppercase tracking-[0.25em] text-muted">Recent solves</h2>
      {progress.recent.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          No solved cases yet. <Link href="/challenges" className="text-accent hover:text-accent-hover">Pick a case →</Link>
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface" data-testid="recent-solves">
          {progress.recent.map(({ solve, challenge }) => (
            <li key={solve.challengeId} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
                {challenge ? (
                  <Link href={`/challenges/${challenge.slug}`} className="truncate hover:text-accent">
                    {challenge.title}
                  </Link>
                ) : (
                  <span className="truncate text-muted">Retired case</span>
                )}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted">
                +{solve.pointsAwarded} · {formatDate(solve.solvedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-mono text-xs uppercase tracking-[0.25em] text-muted">Account</h2>
      <div className="mt-4 max-w-md rounded-xl border border-border bg-surface p-5">
        <UsernameForm current={viewer.username} />
        <p className="mt-4 text-xs text-muted">
          Your email is private and never shown publicly. <Link href="/reset-password" className="text-accent hover:text-accent-hover">Change password</Link>
        </p>
      </div>
    </>
  );
}

function SignedOutPreview() {
  return (
    <>
      <div className="mt-6">
        <Notice title="Accounts are not connected" tone="locked">
          Your profile tracks total points, solved cases and per-region progress. It becomes available once accounts are
          connected.
        </Notice>
      </div>
      <h2 className="mt-10 font-mono text-xs uppercase tracking-[0.25em] text-muted">Region progress (preview layout)</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Region progress">
        {REGIONS.map((r) => (
          <li key={r.slug} className="rounded-xl border border-border bg-surface p-4">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider" style={{ color: r.accent }}>
              <RegionIcon icon={r.icon} className="size-3.5" /> {r.name}
            </p>
            <p className="mt-1 text-sm font-semibold">{r.forensicDomain}</p>
            <p className="mt-3 font-mono text-xs text-muted">— solved</p>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function ProfilePage() {
  const { accountsEnabled } = getConfigState();
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Investigator file</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Profile</h1>
      {accountsEnabled ? (
        <Suspense fallback={<p className="mt-6 font-mono text-xs text-muted">[ ACCESSING INVESTIGATOR FILE... ]</p>}>
          <ProfileContent />
        </Suspense>
      ) : (
        <SignedOutPreview />
      )}
    </div>
  );
}
