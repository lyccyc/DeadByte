import type { Metadata } from "next";
import Link from "next/link";
import { getConfigState } from "@/lib/app-config";
import { AuthShell, DisabledField, DisabledSubmit } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Register" };

export default function RegisterPage() {
  const { accountsEnabled } = getConfigState();
  return (
    <AuthShell
      title="Join the expedition"
      subtitle="Your username is public on the leaderboard. Your email never is."
      enabled={accountsEnabled}
      footer={
        <span>
          Already registered? <Link href="/login" className="text-accent hover:text-accent-hover">Sign in</Link>
        </span>
      }
    >
      {accountsEnabled ? (
        <RegisterForm />
      ) : (
        <form className="space-y-4" aria-label="Register (disabled)">
          <DisabledField id="username" label="Username" autoComplete="username" />
          <DisabledField id="email" label="Email" type="email" autoComplete="email" />
          <DisabledField id="password" label="Password" type="password" autoComplete="new-password" />
          <DisabledSubmit>CREATE ACCOUNT</DisabledSubmit>
        </form>
      )}
    </AuthShell>
  );
}
