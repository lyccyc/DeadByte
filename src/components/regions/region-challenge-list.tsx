"use client";

import { useMemo, useState } from "react";
import type { Challenge, Difficulty } from "@/lib/challenge-types";
import { ChallengeGrid } from "@/components/challenges/challenge-grid";
import { DifficultyFilter } from "@/components/challenges/difficulty-filter";
import { SolvedFilter, applySolvedFilter, type SolvedFilterValue } from "@/components/challenges/solved-filter";

/** `solvedIds` is provided only for signed-in players (enables the Status filter and progress count). */
export function RegionChallengeList({
  challenges,
  solvedIds,
  signedOutHint,
}: {
  challenges: Challenge[];
  solvedIds?: string[];
  signedOutHint?: string;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();
  const [solvedFilter, setSolvedFilter] = useState<SolvedFilterValue>("all");
  const solved = useMemo(() => new Set(solvedIds ?? []), [solvedIds]);
  const visible = useMemo(
    () => applySolvedFilter(difficulty ? challenges.filter((c) => c.difficulty === difficulty) : challenges, solvedFilter, solved),
    [challenges, difficulty, solvedFilter, solved],
  );
  const solvedHere = challenges.filter((c) => solved.has(c.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <DifficultyFilter value={difficulty} onChange={setDifficulty} />
          {solvedIds ? (
            <div className="sm:w-44">
              <SolvedFilter
                id="region-solved"
                value={solvedFilter}
                onChange={setSolvedFilter}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-fg focus:border-accent"
              />
            </div>
          ) : null}
        </div>
        <p className="font-mono text-xs text-muted" aria-live="polite">
          {solvedIds ? (
            <span className="mr-3 text-success" data-testid="region-progress">
              {solvedHere}/{challenges.length} solved
            </span>
          ) : null}
          {visible.length} of {challenges.length} case{challenges.length === 1 ? "" : "s"}
        </p>
      </div>
      <ChallengeGrid
        challenges={visible}
        solvedIds={solved}
        emptyMessage={challenges.length === 0 ? "No published cases in this region yet." : "No cases match these filters."}
      />
      {!solvedIds && signedOutHint ? <p className="font-mono text-xs text-muted">{signedOutHint}</p> : null}
    </div>
  );
}
