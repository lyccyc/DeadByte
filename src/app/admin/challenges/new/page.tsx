import Link from "next/link";
import { Suspense } from "react";
import { AdminGate, AdminHeader } from "@/components/admin/admin-gate";
import { ChallengeEditor } from "@/components/admin/challenge-editor";

export default function NewChallengePage() {
  return (
    <>
      <Link href="/admin/challenges" className="font-mono text-xs text-muted hover:text-fg">← All challenges</Link>
      <div className="mt-4">
        <AdminHeader title="New challenge" />
      </div>
      <p className="mt-2 text-sm text-muted">New challenges are saved as drafts. Publish from the challenge list once ready.</p>
      <Suspense fallback={<p className="mt-6 font-mono text-xs text-muted">[ CHECKING CLEARANCE... ]</p>}>
        <AdminGate next="/admin/challenges/new">{() => <ChallengeEditor id={null} hasFlag={false} />}</AdminGate>
      </Suspense>
    </>
  );
}
