import type { ReactNode } from "react";
import { Info, Lock } from "lucide-react";

export function Notice({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: ReactNode;
  tone?: "info" | "locked";
}) {
  const Icon = tone === "locked" ? Lock : Info;
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-surface px-4 py-3" role="note">
      <Icon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="text-sm">
        <p className="font-semibold text-fg">{title}</p>
        <div className="mt-1 text-muted">{children}</div>
      </div>
    </div>
  );
}
