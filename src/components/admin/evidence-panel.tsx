"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, CircleDashed, Loader2, Upload } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { CopyButton } from "@/components/ui/copy-button";

export interface EvidenceRow {
  id: string;
  displayName: string;
  objectKey: string;
  sizeBytes: number;
  sha256: string;
  uploadStatus: "pending" | "verified";
  isActive: boolean;
}

/** Admin evidence list, activate/deactivate, and manifest registration (attach). */
export function EvidencePanel({
  challengeId,
  files,
  storageReady,
}: {
  challengeId: string;
  files: EvidenceRow[];
  storageReady: boolean;
}) {
  const router = useRouter();
  const [manifest, setManifest] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(manifest);
    } catch {
      setMessage({ kind: "error", text: "The manifest is not valid JSON." });
      return;
    }
    if ((parsed as { challengeId?: unknown })?.challengeId !== challengeId) {
      setMessage({ kind: "error", text: "This manifest was uploaded for a different challenge id." });
      return;
    }
    setPending("register");
    try {
      const res = await fetch("/api/v1/admin/evidence/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const details = Array.isArray(body?.error?.details)
          ? ` ${body.error.details.map((d: { path: string; message: string }) => `${d.path}: ${d.message}`).join("; ")}`
          : "";
        setMessage({ kind: "error", text: `${body?.error?.message ?? "Registration failed."}${details}` });
      } else {
        setMessage({ kind: "ok", text: body.data.alreadyRegistered ? "Already registered." : "Verified in R2 and attached." });
        setManifest("");
        router.refresh();
      }
    } catch {
      setMessage({ kind: "error", text: "Network error." });
    } finally {
      setPending(null);
    }
  }

  async function toggle(file: EvidenceRow) {
    if (file.isActive && !window.confirm(`Deactivate ${file.displayName}? Players will no longer be able to download it.`)) return;
    setPending(file.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/admin/evidence/${file.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !file.isActive }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setMessage({ kind: "error", text: body?.error?.message ?? "Update failed." });
      else router.refresh();
    } catch {
      setMessage({ kind: "error", text: "Network error." });
    } finally {
      setPending(null);
    }
  }

  const cli = `npm run upload-evidence -- --challenge ${challengeId} --file <path-to-evidence> --register`;

  return (
    <section aria-labelledby="evidence-admin-title" className="mt-10 rounded-xl border border-border bg-surface p-5" data-testid="evidence-panel">
      <h2 id="evidence-admin-title" className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
        Evidence
      </h2>

      {files.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No evidence attached yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 space-y-1 font-mono text-xs">
                <p className="text-sm text-fg">
                  {f.displayName} <span className="text-muted">· {formatBytes(f.sizeBytes)}</span>
                </p>
                <p className="flex flex-wrap items-center gap-2">
                  {f.uploadStatus === "verified" ? (
                    <span className="inline-flex items-center gap-1 text-success">
                      <CheckCircle2 className="size-3" aria-hidden="true" /> verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-warning">
                      <CircleDashed className="size-3" aria-hidden="true" /> pending
                    </span>
                  )}
                  <span className={f.isActive ? "text-fg" : "text-muted"}>{f.isActive ? "active · attached" : "inactive"}</span>
                </p>
                <p className="break-all text-muted">sha256 {f.sha256}</p>
                <p className="break-all text-muted">key {f.objectKey}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(f)}
                disabled={pending !== null}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-xs text-muted hover:text-fg disabled:opacity-60"
              >
                {pending === f.id ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
                {f.isActive ? "Deactivate" : "Activate"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="text-sm font-semibold text-fg">Attach evidence</h3>
        <p className="mt-1 text-xs text-muted">
          Upload with the trusted local CLI (streams multi-GB files straight to R2 and verifies size and SHA-256). With{" "}
          <code className="font-mono">--register</code> it attaches the file automatically; otherwise paste the manifest it prints below.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="block min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-[11px] text-fg">{cli}</code>
          <CopyButton value={cli} label="Copy upload command" />
        </div>

        {storageReady ? (
          <form onSubmit={register} className="mt-4 space-y-2">
            <label htmlFor="manifest" className="block font-mono text-xs text-muted">
              Upload manifest (JSON)
            </label>
            <textarea
              id="manifest"
              value={manifest}
              onChange={(e) => setManifest(e.target.value)}
              rows={6}
              required
              spellCheck={false}
              placeholder='{"challengeId": "...", "objectKey": "evidence/challenges/...", "displayName": "...", "sizeBytes": 0, "sha256": "..."}'
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-fg focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending !== null || manifest.trim() === ""}
              className="inline-flex items-center gap-2 rounded-md border border-accent px-3 py-2 font-mono text-xs text-accent hover:bg-accent/10 disabled:opacity-60"
            >
              {pending === "register" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
              VERIFY IN R2 &amp; ATTACH
            </button>
          </form>
        ) : (
          <p className="mt-4 text-xs text-warning">
            R2 is not configured on this server (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME), so
            uploaded objects cannot be verified here. See docs/r2-setup.md.
          </p>
        )}
        {message ? (
          <p role={message.kind === "error" ? "alert" : "status"} className={`mt-3 text-xs ${message.kind === "error" ? "text-danger" : "text-success"}`}>
            {message.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}
