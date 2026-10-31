import Link from "next/link";
import { LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { getConfigState } from "@/lib/app-config";
import { getViewer } from "@/server/auth";

export function LoginLink({ variant }: { variant: "desktop" | "mobile" }) {
  return variant === "desktop" ? (
    <Link
      href="/login"
      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-fg transition-colors hover:border-accent hover:text-accent"
    >
      <LogIn className="size-3.5" aria-hidden="true" />
      Login
    </Link>
  ) : (
    <Link href="/login" className="block rounded-md px-3 py-3 text-base text-fg hover:bg-surface-elevated">
      Login
    </Link>
  );
}

/** Account area of the header. Reads the session, so it renders inside <Suspense>. */
export async function HeaderAccount({ variant }: { variant: "desktop" | "mobile" }) {
  if (!getConfigState().accountsEnabled) return <LoginLink variant={variant} />;
  const viewer = await getViewer();
  if (!viewer) return <LoginLink variant={variant} />;

  const initial = viewer.username.slice(0, 1).toUpperCase();
  const signOut = (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className={
          variant === "desktop"
            ? "inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-mono text-xs uppercase tracking-wider text-muted hover:text-fg"
            : "flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-base text-fg hover:bg-surface-elevated"
        }
      >
        <LogOut className="size-3.5" aria-hidden="true" /> Sign out
      </button>
    </form>
  );

  if (variant === "mobile") {
    return (
      <>
        <Link href="/profile" className="flex items-center gap-2 rounded-md px-3 py-3 text-base text-fg hover:bg-surface-elevated">
          <UserRound className="size-4" aria-hidden="true" /> {viewer.username}
        </Link>
        {viewer.role === "admin" ? (
          <Link href="/admin/challenges" className="flex items-center gap-2 rounded-md px-3 py-3 text-base text-fg hover:bg-surface-elevated">
            <ShieldCheck className="size-4" aria-hidden="true" /> Admin
          </Link>
        ) : null}
        {signOut}
      </>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {viewer.role === "admin" ? (
        <Link href="/admin/challenges" className="rounded-md px-2 py-1.5 font-mono text-xs uppercase tracking-wider text-warning hover:text-fg">
          Admin
        </Link>
      ) : null}
      <Link
        href="/profile"
        className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm text-fg transition-colors hover:border-accent"
        data-testid="header-profile"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-accent/20 font-mono text-xs text-accent" aria-hidden="true">
          {initial}
        </span>
        <span className="max-w-32 truncate">{viewer.username}</span>
      </Link>
      {signOut}
    </div>
  );
}
