import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getConfigState } from "@/lib/app-config";
import { AuthShell, DisabledField, DisabledSubmit, FormFallback } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Login" };

export default function LoginPage() {
  const { accountsEnabled } = getConfigState();
  return (
    <AuthShell
      title="Sign in"
      subtitle="Resume your investigation."
      enabled={accountsEnabled}
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <Link href="/register" className="text-accent hover:text-accent-hover">Create an account</Link>
          <Link href="/reset-password" className="hover:text-fg">Forgot password?</Link>
        </div>
      }
    >
      {accountsEnabled ? (
        <Suspense fallback={<FormFallback />}>
          <LoginForm />
        </Suspense>
      ) : (
        <form className="space-y-4" aria-label="Sign in (disabled)">
          <DisabledField id="email" label="Email" type="email" autoComplete="email" />
          <DisabledField id="password" label="Password" type="password" autoComplete="current-password" />
          <DisabledSubmit>SIGN IN</DisabledSubmit>
        </form>
      )}
    </AuthShell>
  );
}
