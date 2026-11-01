import Link from "next/link";
import { Suspense } from "react";
import { isUuid } from "@/lib/api";
import { getConfigState } from "@/lib/app-config";
import { getAdminChallenge } from "@/server/admin/challenges";
import { listChallengeEvidence } from "@/server/admin/evidence";
import { EvidencePanel } from "@/components/admin/evidence-panel";
import { AdminGate, AdminHeader } from "@/components/admin/admin-gate";
import { ChallengeEditor } from "@/components/admin/challenge-editor";
import { StatusActions } from "@/components/admin/status-actions";
import { Notice } from "@/components/ui/notice";

/**
 * Cache Components needs at least one sample param to prerender this route's
 * shell. The placeholder never matches a challenge (it renders "not found");
 * real ids render at request time behind the admin check in <Suspense>.
 */
export function generateStaticParams() {
  return [{ id: "00000000-0000-4000-8000-000000000000" }];
}

async function Editor({ id, created }: { id: string; created: boolean }) {
  const challenge = isUuid(id) ? await getAdminChallenge(id) : null;
  if (!challenge) {
    return (
      <div className="mt-6">
        <Notice title="Challenge not found">It may have been deleted, or the link is wrong.</Notice>
      </div>
    );
  }
  const { hasFlag, status, evidence } = challenge;
  const files = await listChallengeEvidence(challenge.id);
  const fields = {
    slug: challenge.slug,
    region: challenge.region,
    title: challenge.title,
    summary: challenge.summary,
    description: challenge.description,
    category: challenge.category,
    tags: challenge.tags,
    difficulty: challenge.difficulty,
    points: challenge.points,
    requiresEvidence: challenge.requiresEvidence,
    isSample: challenge.isSample,
  };
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-muted">
          Status: <span className="text-fg">{status}</span> · Flag: <span className={hasFlag ? "text-success" : "text-warning"}>{hasFlag ? "set" : "missing"}</span> ·
          Evidence: {evidence.verified}/{evidence.total} verified
          {status === "published" ? (
            <>
              {" · "}
              <Link href={`/challenges/${challenge.slug}`} className="text-accent hover:text-accent-hover">View public page</Link>
            </>
          ) : null}
        </p>
        <StatusActions id={challenge.id} status={status} />
      </div>
      {created ? (
        <p role="status" className="mt-4 text-sm text-success">Draft created.</p>
      ) : null}
      <ChallengeEditor id={challenge.id} initial={fields} hasFlag={hasFlag} />
      <EvidencePanel
        challengeId={challenge.id}
        storageReady={getConfigState().evidenceDownloadsEnabled}
        files={files.map(({ id, displayName, objectKey, sizeBytes, sha256, uploadStatus, isActive }) => ({
          id,
          displayName,
          objectKey,
          sizeBytes,
          sha256,
          uploadStatus,
          isActive,
        }))}
      />
    </>
  );
}

export default function EditChallengePage({ params, searchParams }: PageProps<"/admin/challenges/[id]">) {
  return (
    <>
      <Link href="/admin/challenges" className="font-mono text-xs text-muted hover:text-fg">← All challenges</Link>
      <div className="mt-4">
        <AdminHeader title="Edit challenge" />
      </div>
      <Suspense fallback={<p className="mt-6 font-mono text-xs text-muted">[ LOADING CASE FILE... ]</p>}>
        {Promise.all([params, searchParams]).then(([{ id }, sp]) => (
          <AdminGate next={`/admin/challenges/${id}`}>{() => <Editor id={id} created={sp.created === "1"} />}</AdminGate>
        ))}
      </Suspense>
    </>
  );
}
