import type { Challenge } from "@/lib/challenge-types";
import { ChallengeCard } from "./challenge-card";

export function ChallengeGrid({ challenges, emptyMessage }: { challenges: Challenge[]; emptyMessage: string }) {
  if (challenges.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/50 px-6 py-12 text-center" data-testid="empty-state">
        <p className="font-mono text-sm text-accent">[ NO EVIDENCE FOUND ]</p>
        <p className="mt-2 text-sm text-muted">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {challenges.map((c) => (
        <li key={c.id}>
          <ChallengeCard challenge={c} />
        </li>
      ))}
    </ul>
  );
}
