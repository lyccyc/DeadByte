"use client";

export type SolvedFilterValue = "all" | "solved" | "unsolved";

export function applySolvedFilter<T extends { id: string }>(items: T[], value: SolvedFilterValue, solved: ReadonlySet<string>): T[] {
  if (value === "solved") return items.filter((c) => solved.has(c.id));
  if (value === "unsolved") return items.filter((c) => !solved.has(c.id));
  return items;
}

export function SolvedFilter({
  id,
  value,
  onChange,
  className,
}: {
  id: string;
  value: SolvedFilterValue;
  onChange: (value: SolvedFilterValue) => void;
  className: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-muted">
        Status
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as SolvedFilterValue)} className={className}>
        <option value="all">All cases</option>
        <option value="unsolved">Unsolved</option>
        <option value="solved">Solved</option>
      </select>
    </div>
  );
}
