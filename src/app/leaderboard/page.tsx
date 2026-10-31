import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "All-time DeadByte rankings by points.",
};

export default function LeaderboardPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">All-time</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Leaderboard</h1>
      <p className="mt-2 text-muted">
        Ranked by total points (sum of points awarded at each first solve). Ties are broken by the earliest time the
        score was reached, then by username.
      </p>

      <div className="mt-8 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
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
            <tr>
              <td colSpan={4} className="px-4 py-14 text-center" data-testid="leaderboard-empty">
                <Trophy className="mx-auto size-8 text-warning" aria-hidden="true" />
                <p className="mt-3 font-mono text-sm text-fg">[ SCOREBOARD OFFLINE ]</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                  The leaderboard shows real solves only. It goes live when accounts and server-side scoring are
                  connected — no sample players are displayed in the meantime.
                </p>
                <Link href="/challenges" className="mt-4 inline-block font-mono text-sm text-accent hover:text-accent-hover">
                  Browse challenges →
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
