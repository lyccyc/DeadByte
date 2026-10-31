export function DemoTag({ label = "DEMO" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded border border-warning/50 bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-warning">
      {label}
    </span>
  );
}
