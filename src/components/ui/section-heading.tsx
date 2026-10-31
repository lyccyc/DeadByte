import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  id,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  id?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">{eyebrow}</p>
        <h2 id={id} className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {description ? <p className="mt-2 max-w-2xl text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
