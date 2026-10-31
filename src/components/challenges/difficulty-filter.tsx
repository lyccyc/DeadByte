"use client";

import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from "@/lib/challenge-types";

export function DifficultyFilter({
  value,
  onChange,
}: {
  value: Difficulty | undefined;
  onChange: (value: Difficulty | undefined) => void;
}) {
  const options: (Difficulty | undefined)[] = [undefined, ...DIFFICULTIES];
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">Difficulty</legend>
      {options.map((d) => {
        const selected = value === d;
        return (
          <button
            key={d ?? "all"}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(d)}
            className="rounded-md border border-border px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-fg aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent"
          >
            {d ? DIFFICULTY_LABEL[d] : "All"}
          </button>
        );
      })}
    </fieldset>
  );
}
