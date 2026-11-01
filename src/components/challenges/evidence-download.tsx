"use client";

import { useState } from "react";
import { Download, Loader2, Terminal } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";

interface Grant {
  url: string;
  expiresAt: string;
  displayName: string;
}

/** Shell-quote for a POSIX `curl` command line. */
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * Requests a short-lived signed R2 URL from the server, then starts the
 * download directly from R2 (no bytes pass through DeadByte). The link is
 * also offered for `curl -C -` so large downloads can be resumed.
 */
export function EvidenceDownloadButton({ evidenceId, displayName }: { evidenceId: string; displayName: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grant, setGrant] = useState<Grant | null>(null);

  async function request() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/evidence/${evidenceId}/download`, { method: "POST", credentials: "same-origin" });
      const body = await res.json().catch(() => null);
      if (!res.ok || typeof body?.url !== "string") {
        setGrant(null);
        setError(
          res.status === 401
            ? "Your session expired. Sign in again to download."
            : (body?.error?.message ?? "Could not create a download link."),
        );
        return;
      }
      setGrant({ url: body.url, expiresAt: body.expiresAt, displayName: body.displayName });
      // Navigate a hidden link: R2 answers with Content-Disposition: attachment, so the page stays put.
      const a = document.createElement("a");
      a.href = body.url;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  const expires = grant ? new Date(grant.expiresAt) : null;
  return (
    <div className="flex w-full flex-col items-end gap-2 sm:w-auto">
      <button
        type="button"
        onClick={request}
        disabled={pending}
        data-testid="evidence-download"
        className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent/10 px-3 py-2 font-mono text-xs tracking-wider text-accent hover:bg-accent/20 disabled:opacity-60"
        aria-label={`Download evidence ${displayName}`}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}
        {grant ? "NEW DOWNLOAD LINK" : "DOWNLOAD EVIDENCE"}
      </button>
      {error ? (
        <p role="alert" className="max-w-xs text-right text-xs text-danger">
          {error}
        </p>
      ) : null}
      {grant && expires ? (
        <div role="status" className="w-full max-w-md rounded-md border border-border bg-background/60 p-3 text-left text-xs text-muted">
          <p className="text-fg">Download started from secure storage.</p>
          <p className="mt-1">
            Link valid until <time dateTime={grant.expiresAt}>{expires.toLocaleTimeString()}</time>. Request a new link to
            resume after that. Treat it like a password: anyone holding it can download until it expires.
          </p>
          <p className="mt-2 flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted">
            <Terminal className="size-3" aria-hidden="true" /> Resumable CLI download
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="block min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-[11px] text-fg">
              curl -fL -C - -o {q(grant.displayName)} {"'…'"}
            </code>
            <CopyButton value={`curl -fL -C - -o ${q(grant.displayName)} ${q(grant.url)}`} label={`Copy curl command for ${grant.displayName}`} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
