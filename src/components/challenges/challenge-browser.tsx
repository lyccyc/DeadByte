"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { REGIONS } from "@/config/regions";
import { DIFFICULTIES, DIFFICULTY_LABEL, type Challenge } from "@/lib/challenge-types";
import { filterChallenges } from "@/lib/challenge-filter";
import { challengeFilterSchema, searchParamsToObject } from "@/lib/validation";
import { ChallengeGrid } from "./challenge-grid";

const selectClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-fg focus:border-accent";

export function ChallengeBrowser({ challenges }: { challenges: Challenge[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = challengeFilterSchema.parse(searchParamsToObject(new URLSearchParams(searchParams.toString())));
  const [query, setQuery] = useState(filters.q ?? "");

  const visible = useMemo(
    () => filterChallenges(challenges, { ...filters, q: query }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [challenges, filters.region, filters.difficulty, filters.sort, query],
  );

  const update = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const hasFilters = Boolean(filters.region || filters.difficulty || query || filters.sort);

  return (
    <div className="space-y-6">
      <form
        role="search"
        className="grid gap-3 rounded-xl border border-border bg-surface/60 p-4 md:grid-cols-[2fr_1fr_1fr_1fr]"
        onSubmit={(e) => e.preventDefault()}
      >
        <div>
          <label htmlFor="q" className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-muted">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              id="q"
              type="search"
              value={query}
              maxLength={100}
              placeholder="Title, category or tag…"
              onChange={(e) => {
                setQuery(e.target.value);
                update("q", e.target.value.trim() || undefined);
              }}
              className={`${selectClass} pl-9`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="region" className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-muted">
            Region
          </label>
          <select id="region" value={filters.region ?? ""} onChange={(e) => update("region", e.target.value || undefined)} className={selectClass}>
            <option value="">All regions</option>
            {REGIONS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name} — {r.forensicDomain}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="difficulty" className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-muted">
            Difficulty
          </label>
          <select
            id="difficulty"
            value={filters.difficulty ?? ""}
            onChange={(e) => update("difficulty", e.target.value || undefined)}
            className={selectClass}
          >
            <option value="">Any</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sort" className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-muted">
            Sort
          </label>
          <select id="sort" value={filters.sort ?? "newest"} onChange={(e) => update("sort", e.target.value === "newest" ? undefined : e.target.value)} className={selectClass}>
            <option value="newest">Newest</option>
            <option value="points-desc">Points: high → low</option>
            <option value="points-asc">Points: low → high</option>
          </select>
        </div>
      </form>

      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-xs text-muted" aria-live="polite" data-testid="result-count">
          {visible.length} case{visible.length === 1 ? "" : "s"} found
        </p>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              router.replace(pathname, { scroll: false });
            }}
            className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:text-accent-hover"
          >
            <X className="size-3.5" aria-hidden="true" /> Clear filters
          </button>
        ) : null}
      </div>

      <ChallengeGrid challenges={visible} emptyMessage="Try a different search term or remove a filter." />
    </div>
  );
}
