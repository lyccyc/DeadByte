"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, Loader2, Rocket } from "lucide-react";
import type { ChallengeStatus } from "@/lib/challenge-types";

export function StatusActions({ id, status }: { id: string; status: ChallengeStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState<"publish" | "archive" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "publish" | "archive") {
    if (action === "archive" && !window.confirm("Archive this challenge? It will be hidden from players. Awarded points are kept.")) return;
    setPending(action);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/challenges/${id}/${action}`, { method: "POST", credentials: "same-origin" });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error?.message ?? `Could not ${action}.`);
      else router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setPending(null);
    }
  }

  const btn = "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs disabled:opacity-60";
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {status !== "published" ? (
          <button type="button" onClick={() => run("publish")} disabled={pending !== null} className={`${btn} border-success/50 text-success hover:bg-success/10`}>
            {pending === "publish" ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Rocket className="size-3" aria-hidden="true" />}
            Publish
          </button>
        ) : null}
        {status !== "archived" ? (
          <button type="button" onClick={() => run("archive")} disabled={pending !== null} className={`${btn} border-border text-muted hover:text-fg`}>
            {pending === "archive" ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Archive className="size-3" aria-hidden="true" />}
            Archive
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="max-w-xs text-right text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
