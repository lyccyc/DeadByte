import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getConfigState } from "@/lib/app-config";
import { getSessionUser } from "@/server/auth";
import { AuthShell, FormFallback } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/forms";
import { Notice } from "@/components/ui/notice";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

async function UpdatePasswordGate() {
  // The recovery link (/auth/confirm) establishes a session before redirecting here.
  if (!(await getSessionUser())) {
    return (
      <Notice title="Reset link required" tone="locked">
        Open the link from your password reset email, or <Link href="/reset-password" className="text-accent hover:text-accent-hover">request a new one</Link>.
      </Notice>
    );
  }
  return <UpdatePasswordForm />;
}

export default function UpdatePasswordPage() {
  const { accountsEnabled } = getConfigState();
  return (
    <AuthShell title="Choose a new password" subtitle="Set a new password for your account." enabled={accountsEnabled}>
      {accountsEnabled ? (
        <Suspense fallback={<FormFallback />}>
          <UpdatePasswordGate />
        </Suspense>
      ) : (
        <p className="text-sm text-muted">Password changes are unavailable without Supabase Auth.</p>
      )}
    </AuthShell>
  );
}
