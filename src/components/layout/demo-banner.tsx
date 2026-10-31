import { AlertTriangle, FlaskConical } from "lucide-react";
import { getConfigState } from "@/lib/app-config";

/**
 * Persistent, honest notice about what is and is not operational.
 * Server component: reads env on the server only and never exposes values.
 */
export function DemoBanner() {
  const state = getConfigState();
  if (state.backendFeaturesEnabled) return null;

  if (state.mode === "misconfigured") {
    return (
      <div role="status" className="border-b border-warning/40 bg-warning/10">
        <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 font-mono text-xs text-warning sm:px-6">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            MISCONFIGURED: some backend variables are set but {state.missing.length} required value(s) are missing.
            Protected features stay disabled. See README → Configuration.
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
