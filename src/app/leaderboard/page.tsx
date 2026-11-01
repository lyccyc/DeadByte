import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Trophy } from "lucide-react";
import { getLeaderboardPage, type LeaderboardPage } from "@/server/leaderboard";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "All-time DeadByte rankings by points.",
};

function EmptyRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={4} className="px-4 py-14 text-center" data-testid="leaderboard-empty">
        <Trophy className="mx-auto size-8 text-warning" aria-hidden="true" />
        <p className="mt-3 font-mono text-sm text-fg">{title}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p>
        <Link href="/challenges" className="mt-4 inline-block font-mono text-sm text-accent hover:text-accent-hover">
          Browse challenges →
        </Link>
      </td>
    </tr>
  );
}

function Rows({ board }: { board: LeaderboardPage }) {
  if (!board.available) {
    return (
      <EmptyRow title="[ SCOREBOARD OFFLINE ]">
        The leaderboard shows real solves only. It goes live when accounts and server-side scoring are connected — no
        sample players are displayed in the meantime.
      </EmptyRow>
    );
  }
  if (board.entries.length === 0) {
    return (
      <EmptyRow title={board.page > 1 ? "[ END OF RECORDS ]" : "[ NO SOLVES YET ]"}>
        {board.page > 1 ? "There are no players on this page." : "Nobody has recovered a flag yet. Be the first investigator on the board."}
      </EmptyRow>
    );
  }
  return (
    <>
      {board.entries.map((e) => (
        <tr key={e.rank} className="border-t border-border" data-testid="leaderboard-row">
          <td className="px-4 py-3 font-mono text-muted">{e.rank}</td>
          <td className="px-4 py-3">
            <span className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-xs text-accent" aria-hidden="true">
                {e.username.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-fg">{e.username}</span>
                <span className="block font-mono text-[11px] text-muted">last solve {formatDate(e.lastSolveAt)}</span>
              </span>
            </span>
          </td>
          <td className="px-4 py-3 text-right font-mono">{e.solvedCount}</td>
          <td className="px-4 py-3 text-right font-mono font-semibold text-accent">{e.points}</td>
        </tr>
      ))}
    </>
  );
}

async function Board({ searchParams }: { searchParams: PageProps<"/leaderboard">["searchParams"] }) {
  const raw = (await searchParams).page;
  const page = Number.parseInt(typeof raw === "string" ? raw : "1", 10);
  const board = await getLeaderboardPage(Number.isFinite(page) ? page : 1);
  return (
    <>
      <div className="mt-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <caption className="sr-only">All-time leaderboard</caption>
          <thead className="bg-surface font-mono text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th scope="col" className="px-4 py-3">Rank</th>
              <th scope="col" className="px-4 py-3">Investigator</th>
              <th scope="col" className="px-4 py-3 text-right">Solved</th>
              <th scope="col" className="px-4 py-3 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            <Rows board={board} />
          </tbody>
        </table>
      </div>
      {board.totalPages > 1 ? (
        <nav aria-label="Leaderboard pages" className="mt-4 flex items-center justify-between font-mono text-sm">
          {board.page > 1 ? (
            <Link href={`/leaderboard?page=${board.page - 1}`} className="text-accent hover:text-accent-hover">← Previous</Link>
          ) : <span />}
          <span className="text-muted">
            Page {board.page} of {board.totalPages} · {board.totalPlayers} players
          </span>
          {board.page < board.totalPages ? (
            <Link href={`/leaderboard?page=${board.page + 1}`} className="text-accent hover:text-accent-hover">Next →</Link>
          ) : <span />}
        </nav>
      ) : null}
    </>
  );
}

export default function LeaderboardPageView({ searchParams }: PageProps<"/leaderboard">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">All-time</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Leaderboard</h1>
      <p className="mt-2 text-muted">
        Ranked by total points (sum of points awarded at each first solve). Ties are broken by the earliest time the
        score was reached, then by username.
      </p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-xl border border-border bg-surface/60" aria-busy="true" />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
