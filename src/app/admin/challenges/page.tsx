import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, CircleDashed, Plus } from "lucide-react";
import { getRegionOrThrow } from "@/config/regions";
import { formatDate } from "@/lib/format";
import { listAdminChallenges } from "@/server/admin/challenges";
import { AdminGate, AdminHeader } from "@/components/admin/admin-gate";
import { StatusActions } from "@/components/admin/status-actions";

const STATUS_STYLE = {
  draft: "border-warning/50 text-warning",
  published: "border-success/50 text-success",
  archived: "border-border text-muted",
} as const;

async function ChallengeTable() {
  const challenges = await listAdminChallenges();
  if (challenges.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <p className="font-mono text-sm text-accent">[ NO CASES YET ]</p>
        <p className="mt-2 text-sm text-muted">Create a draft challenge to get started.</p>
      </div>
    );
  }
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <caption className="sr-only">All challenges</caption>
        <thead className="bg-surface font-mono text-[11px] uppercase tracking-wider text-muted">
          <tr>
            <th scope="col" className="px-4 py-3">Challenge</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Flag</th>
            <th scope="col" className="px-4 py-3">Evidence</th>
            <th scope="col" className="px-4 py-3 text-right">Points</th>
            <th scope="col" className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {challenges.map((c) => {
            const region = getRegionOrThrow(c.region);
            return (
              <tr key={c.id} className="border-t border-border align-top" data-testid="admin-row">
                <td className="px-4 py-3">
                  <Link href={`/admin/challenges/${c.id}`} className="font-medium text-fg hover:text-accent">
                    {c.title}
                  </Link>
                  <p className="font-mono text-[11px] text-muted">
                    {region.name} · {region.forensicDomain} · /{c.slug}
                    {c.isSample ? " · sample" : ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[11px] uppercase ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                  {c.publishedAt ? <p className="mt-1 font-mono text-[11px] text-muted">{formatDate(c.publishedAt)}</p> : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {c.hasFlag ? (
                    <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-3.5" aria-hidden="true" /> set</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-warning"><CircleDashed className="size-3.5" aria-hidden="true" /> missing</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {c.evidence.verified}/{c.evidence.total} verified
                  <br />
                  {c.requiresEvidence ? "required" : "not required"}
                </td>
                <td className="px-4 py-3 text-right font-mono">{c.points}</td>
                <td className="px-4 py-3 text-right">
                  <StatusActions id={c.id} status={c.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminChallengesPage() {
  return (
    <>
      <AdminHeader title="Challenges">
        <Link
          href="/admin/challenges/new"
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-mono text-sm font-semibold text-background hover:bg-accent-hover"
        >
          <Plus className="size-4" aria-hidden="true" /> New challenge
        </Link>
      </AdminHeader>
      <p className="mt-2 text-sm text-muted">
        Publishing requires a flag and, when “requires evidence” is set, at least one verified evidence file. Upload
        evidence with <code className="font-mono">npm run upload-evidence</code> and attach it on the challenge&apos;s edit page.
      </p>
      <Suspense fallback={<p className="mt-6 font-mono text-xs text-muted">[ LOADING CASE FILES... ]</p>}>
        <AdminGate next="/admin/challenges">{() => <ChallengeTable />}</AdminGate>
      </Suspense>
    </>
  );
}
