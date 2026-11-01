import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { checkAdmin } from "@/server/auth";
import { Notice } from "@/components/ui/notice";

/** Server-side admin check for admin pages (the API routes check again independently). */
export async function AdminGate({ children, next }: { children: (adminId: string) => ReactNode; next: string }) {
  const check = await checkAdmin();
  if (check.ok) return <>{children(check.user.id)}</>;
  return (
    <div className="mt-6" data-testid="admin-denied">
      <Notice title={check.status === 401 ? "Sign-in required" : check.status === 403 ? "Access denied" : "Admin unavailable"} tone="locked">
        {check.status === 401 ? (
          <>
            Sign in with an administrator account.{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-accent hover:text-accent-hover">Go to login</Link>
          </>
        ) : check.status === 403 ? (
          "This area is restricted to DeadByte administrators."
        ) : (
          "Accounts are not configured on this deployment, so admin tools are disabled (fail closed)."
        )}
      </Notice>
    </div>
  );
}

export function AdminHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-warning">
          <ShieldAlert className="size-3.5" aria-hidden="true" /> Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
      </div>
      {children}
    </div>
  );
}
