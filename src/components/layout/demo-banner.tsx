import { AlertTriangle, DatabaseZap, FlaskConical } from "lucide-react";
import { getConfigState } from "@/lib/app-config";
import { getCatalogue } from "@/server/catalogue";

/**
 * Persistent, honest notice about what is and is not operational.
 * Server component: reads env on the server only and never exposes values.
 */
export async function DemoBanner() {
  const state = getConfigState();

  if (state.mode === "misconfigured") {
    return (
      <div role="status" className="border-b border-warning/40 bg-warning/10">
        <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 font-mono text-xs text-warning sm:px-6">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            MISCONFIGURED: {state.problems.join("; ")}. Accounts and scoring stay disabled. See README → Configuration.
          </span>
        </p>
      </div>
    );
  }

  if (state.mode === "configured") {
    const { error } = await getCatalogue();
    if (!error) return null;
    return (
      <div role="status" className="border-b border-danger/40 bg-danger/10">
        <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 font-mono text-xs text-danger sm:px-6" data-testid="db-banner">
          <DatabaseZap className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {error === "schema_missing"
              ? "DATABASE NOT READY: the Supabase migrations have not been applied. See docs/database.md."
              : "DATABASE UNAVAILABLE: challenges could not be loaded. Retrying shortly."}
          </span>
        </p>
      </div>
    );
  }

  return (
    <div role="status" className="border-b border-border bg-surface/80">
      <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 font-mono text-xs text-muted sm:px-6">
        <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
        <span>
          <span className="text-warning">DEMO MODE</span> — browsing a preview catalogue. Accounts, flag verification and
          evidence downloads are not connected yet.
        </span>
      </p>
    </div>
  );
}
