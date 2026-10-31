"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <p className="font-mono text-sm text-danger">ERROR // CHAIN OF CUSTODY BROKEN</p>
      <h1 className="mt-2 text-3xl font-bold">Something went wrong.</h1>
      <p className="mt-2 text-muted">An unexpected error occurred. You can retry or return to the archive.</p>
      <div className="mt-6 flex gap-4 font-mono text-sm">
        <button type="button" onClick={() => retry()} className="text-accent hover:text-accent-hover">Try again</button>
        <Link href="/" className="text-muted hover:text-fg">Home</Link>
      </div>
    </div>
  );
}
