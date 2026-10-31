import { Flag, Lock } from "lucide-react";

/**
 * Flag submission panel.
 *
 * Phase 1: the server-side verifier (Supabase + HMAC) is not connected, so the
 * form is rendered visibly DISABLED and has no submit handler. Phase 2 replaces
 * it with a client form that POSTs to /api/v1/challenges/:id/submit. Flags are
 * never compared in the browser.
 */
export function FlagForm() {
  return (
    <section aria-labelledby="flag-title" className="rounded-xl border border-border bg-surface p-5">
      <h2 id="flag-title" className="flex items-center gap-2 font-semibold">
        <Flag className="size-4 text-accent" aria-hidden="true" /> Submit flag
      </h2>
      <form className="mt-4 space-y-3" aria-describedby="flag-status">
        <label htmlFor="flag" className="block font-mono text-[11px] uppercase tracking-wider text-muted">
          Flag
        </label>
        <input
          id="flag"
          name="flag"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="DEADBYTE{...}"
          disabled
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-fg placeholder:text-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 font-mono text-sm font-semibold tracking-wider text-background disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-muted"
        >
          <Lock className="size-4" aria-hidden="true" />
          VERIFY FLAG
        </button>
      </form>
      <p id="flag-status" className="mt-3 text-xs text-muted">
        Unavailable in demo mode: server-side flag verification and accounts are not connected yet. Nothing is
        submitted.
      </p>
    </section>
  );
}
