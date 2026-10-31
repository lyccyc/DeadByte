import Link from "next/link";
import { REGIONS } from "@/config/regions";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-sans text-lg font-bold tracking-[0.2em]">
            DEAD<span className="text-accent">BYTE</span>
          </p>
          <p className="mt-2 text-sm text-muted">A Digital Forensics CTF Expedition.</p>
          <p className="mt-1 font-mono text-xs text-muted">Nothing Deleted. Nothing Forgotten.</p>
        </div>
        <nav aria-label="Regions">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Regions</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {REGIONS.map((r) => (
              <li key={r.slug}>
                <Link href={`/regions/${r.slug}`} className="text-muted hover:text-fg">
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Footer">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Archive</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li><Link href="/challenges" className="text-muted hover:text-fg">All challenges</Link></li>
            <li><Link href="/leaderboard" className="text-muted hover:text-fg">Leaderboard</Link></li>
            <li><Link href="/login" className="text-muted hover:text-fg">Login</Link></li>
          </ul>
        </nav>
      </div>
      <p className="border-t border-border py-4 text-center font-mono text-[11px] text-muted">
        Map data derived from Natural Earth (public domain).
      </p>
    </footer>
  );
}
