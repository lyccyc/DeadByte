"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { LogIn, Menu, X } from "lucide-react";
import { Wordmark } from "./wordmark";
import { NAV_LINKS } from "./nav-links";

function isActive(pathname: string, href: string): boolean {
  if (href.startsWith("/#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  // The menu remembers the path it was opened on, so navigating closes it automatically.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (value: boolean | ((v: boolean) => boolean)) =>
    setOpenedOn((cur) => ((typeof value === "function" ? value(cur === pathname) : value) ? pathname : null));
  const menuId = useId();

  // Close the mobile menu on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenedOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Wordmark />

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive(pathname, link.href) ? "page" : undefined}
                className="rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-fg aria-[current=page]:text-accent"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="ml-2">
            <Link
              href="/login"
              aria-current={pathname === "/login" ? "page" : undefined}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-fg transition-colors hover:border-accent hover:text-accent"
            >
              <LogIn className="size-3.5" aria-hidden="true" />
              Login
            </Link>
          </li>
        </ul>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-md border border-border text-fg md:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </nav>

      <div id={menuId} hidden={!open} className="border-t border-border bg-surface md:hidden">
        <ul className="mx-auto flex max-w-6xl flex-col px-4 py-2">
          {[...NAV_LINKS, { href: "/login", label: "Login" } as const].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(pathname, link.href) ? "page" : undefined}
                className="block rounded-md px-3 py-3 text-base text-fg hover:bg-surface-elevated aria-[current=page]:text-accent"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
