"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckCircle2, CircleAlert, Flag, Loader2, Lock, Timer } from "lucide-react";

/**
 * Flag submission. The flag is sent ONLY to the server-side verifier
 * (POST /api/v1/challenges/:id/submit); nothing is compared in the browser.
 */

type Result =
  | { kind: "correct"; message: string; pointsAwarded: number; alreadySolved: boolean }
  | { kind: "incorrect"; message: string }
  | { kind: "rate_limited"; message: string }
  | { kind: "signed_out"; message: string }
  | { kind: "error"; message: string };

export function FlagForm({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const [flag, setFlag] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (!flag.trim()) {
      setResult({ kind: "error", message: "Enter a flag." });
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/v1/challenges/${encodeURIComponent(challengeId)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag }),
        credentials: "same-origin",
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body && typeof body.correct === "boolean") {
        if (body.correct) {
          setResult({ kind: "correct", message: body.message, pointsAwarded: body.pointsAwarded, alreadySolved: body.alreadySolved });
          setFlag("");
          router.refresh();
        } else {
          setResult({ kind: "incorrect", message: body.message });
        }
      } else if (res.status === 401) {
        setResult({ kind: "signed_out", message: "Your session has expired." });
      } else if (res.status === 429) {
        const wait = res.headers.get("Retry-After");
        setResult({ kind: "rate_limited", message: `${body?.error?.message ?? "Too many attempts."}${wait ? ` Try again in ${wait}s.` : ""}` });
      } else {
        setResult({ kind: "error", message: body?.error?.message ?? "Submission failed. Try again." });
      }
    } catch {
      setResult({ kind: "error", message: "Network error. Check your connection and try again." });
    } finally {
      setPending(false);
    }
  }

  const tone =
    result?.kind === "correct"
      ? "border-success/40 bg-success/10 text-success"
      : result?.kind === "rate_limited"
        ? "border-warning/40 bg-warning/10 text-warning"
        : "border-danger/40 bg-danger/10 text-danger";
  const Icon = result?.kind === "correct" ? CheckCircle2 : result?.kind === "rate_limited" ? Timer : CircleAlert;

  return (
    <section aria-labelledby="flag-title" className="rounded-xl border border-border bg-surface p-5">
      <h2 id="flag-title" className="flex items-center gap-2 font-semibold">
        <Flag className="size-4 text-accent" aria-hidden="true" /> Submit flag
      </h2>
      <form className="mt-4 space-y-3" onSubmit={onSubmit} noValidate>
        <label htmlFor="flag" className="block font-mono text-[11px] uppercase tracking-wider text-muted">
          Flag
        </label>
        <input
          id="flag"
          name="flag"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="DEADBYTE{...}"
          maxLength={256}
          value={flag}
          onChange={(e) => setFlag(e.target.value)}
          aria-describedby="flag-result"
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-accent"
          data-testid="flag-input"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 font-mono text-sm font-semibold tracking-wider text-background transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
          data-testid="flag-submit"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? "VERIFYING…" : "VERIFY FLAG"}
        </button>
      </form>
      <div id="flag-result" aria-live="polite" className="mt-3">
        {result ? (
          <p className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${tone}`} data-testid="flag-result">
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {result.message}
              {result.kind === "correct" && !result.alreadySolved ? ` +${result.pointsAwarded} points.` : null}
              {result.kind === "signed_out" ? (
                <>
                  {" "}
                  <Link href="/login" className="underline">Sign in again</Link>
                </>
              ) : null}
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** Non-interactive panel for visitors who cannot submit (signed out / demo). */
export function FlagFormLocked({ reason, action }: { reason: string; action?: { href: string; label: string } }) {
  return (
    <section aria-labelledby="flag-title" className="rounded-xl border border-border bg-surface p-5">
      <h2 id="flag-title" className="flex items-center gap-2 font-semibold">
        <Flag className="size-4 text-accent" aria-hidden="true" /> Submit flag
      </h2>
      <div className="mt-4 space-y-3">
        <label htmlFor="flag" className="block font-mono text-[11px] uppercase tracking-wider text-muted">
          Flag
        </label>
        <input
          id="flag"
          type="text"
          disabled
          placeholder="DEADBYTE{...}"
          aria-describedby="flag-status"
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-fg placeholder:text-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {action ? (
          <Link
            href={action.href}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-accent px-4 py-2 font-mono text-sm font-semibold tracking-wider text-accent hover:bg-accent/10"
          >
            <Lock className="size-4" aria-hidden="true" />
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-surface-elevated px-4 py-2 font-mono text-sm font-semibold tracking-wider text-muted disabled:cursor-not-allowed"
          >
            <Lock className="size-4" aria-hidden="true" />
            VERIFY FLAG
          </button>
        )}
      </div>
      <p id="flag-status" className="mt-3 text-xs text-muted">
        {reason}
      </p>
    </section>
  );
}
