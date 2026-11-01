import type { ReactNode } from "react";
import { ExplorerPenguin } from "@/components/penguin/explorer-penguin";
import { Notice } from "@/components/ui/notice";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  enabled,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  /** False in demo/misconfigured mode: children should be the disabled preview form. */
  enabled: boolean;
}) {
  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_1.1fr]">
      <div className="hidden md:block">
        <ExplorerPenguin className="mx-auto h-auto w-56" title="" aria-hidden="true" />
        <p className="mt-4 text-center font-mono text-xs text-muted">DEADBYTE // EVIDENCE ARCHIVE</p>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        {enabled ? null : (
          <div className="mt-6">
            <Notice title="Accounts are not connected" tone="locked">
              This deployment is running without Supabase Auth (demo or misconfigured mode). The form below is disabled and
              sends nothing.
            </Notice>
          </div>
        )}
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-6 text-sm text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}

export function DisabledField({ id, label, type = "text", autoComplete }: { id: string; label: string; type?: string; autoComplete?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-muted">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        disabled
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-fg disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}

export function DisabledSubmit({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled
      className="w-full rounded-md bg-surface-elevated px-4 py-2 font-mono text-sm font-semibold tracking-wider text-muted disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

export function FormFallback() {
  return <div className="h-48 animate-pulse rounded-lg bg-surface-elevated/50" aria-busy="true" aria-label="Loading form" />;
}
