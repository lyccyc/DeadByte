import { DIFFICULTY_LABEL, type Difficulty } from "@/lib/challenge-types";

const STYLES: Record<Difficulty, string> = {
  easy: "border-success/50 text-success",
  medium: "border-warning/50 text-warning",
  hard: "border-accent/60 text-accent",
  insane: "border-danger/70 text-danger bg-danger/10",
};

const PIPS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, insane: 4 };

/** Difficulty is conveyed by text and pip count, not colour alone. */
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${STYLES[difficulty]}`}
    >
      <span aria-hidden="true" className="flex gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`size-1.5 rounded-full ${i <= PIPS[difficulty] ? "bg-current" : "bg-current/20"}`} />
        ))}
      </span>
      {DIFFICULTY_LABEL[difficulty]}
    </span>
  );
}
