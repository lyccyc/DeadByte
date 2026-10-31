import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/" className="group flex items-baseline gap-2 font-mono text-sm tracking-widest" aria-label="DeadByte home">
      <span className="font-sans text-lg font-bold tracking-[0.2em] text-fg">
        DEAD<span className="text-accent">BYTE</span>
      </span>
      <span className="hidden text-xs text-muted sm:inline" aria-hidden="true">
        {"// EVIDENCE ARCHIVE"}
      </span>
    </Link>
  );
}
