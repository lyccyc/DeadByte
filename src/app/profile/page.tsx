import type { Metadata } from "next";
import Link from "next/link";
import { REGIONS } from "@/config/regions";
import { RegionIcon } from "@/components/regions/region-icon";
import { Notice } from "@/components/ui/notice";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Investigator file</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Profile</h1>
      <div className="mt-6">
        <Notice title="Sign-in required" tone="locked">
          Your profile tracks total points, solved cases and per-region progress. It becomes available once accounts are
          connected. <Link href="/login" className="text-accent hover:text-accent-hover">Go to login</Link>
        </Notice>
      </div>

      <h2 className="mt-10 font-mono text-xs uppercase tracking-[0.25em] text-muted">Region progress (preview layout)</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Region progress">
        {REGIONS.map((r) => (
          <li key={r.slug} className="rounded-xl border border-border bg-surface p-4">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider" style={{ color: r.accent }}>
              <RegionIcon icon={r.icon} className="size-3.5" /> {r.name}
            </p>
            <p className="mt-1 text-sm font-semibold">{r.forensicDomain}</p>
            <p className="mt-3 font-mono text-xs text-muted">— solved</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
