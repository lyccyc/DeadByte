"use client";

import { useMemo, useState } from "react";
import type { Challenge, Difficulty } from "@/lib/challenge-types";
import { ChallengeGrid } from "@/components/challenges/challenge-grid";
import { DifficultyFilter } from "@/components/challenges/difficulty-filter";

export function RegionChallengeList({ challenges }: { challenges: Challenge[] }) {
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();
  const visible = useMemo(
    () => (difficulty ? challenges.filter((c) => c.difficulty === difficulty) : challenges),
    [challenges, difficulty],
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DifficultyFilter value={difficulty} onChange={setDifficulty} />
        <p className="font-mono text-xs text-muted" aria-live="polite">
          {visible.length} of {challenges.length} case{challenges.length === 1 ? "" : "s"}
        </p>
      </div>
      <ChallengeGrid
        challenges={visible}
        emptyMessage={challenges.length === 0 ? "No published cases in this region yet." : "No cases match this difficulty."}
      />
      <p className="font-mono text-xs text-muted">Solved-status filtering becomes available once sign-in is connected.</p>
    </div>
  );
}
