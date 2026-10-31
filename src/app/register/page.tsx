import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, DisabledField, DisabledSubmit } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Register" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Join the expedition"
      subtitle="Your username is public on the leaderboard. Your email never is."
      footer={
        <span>
          Already registered? <Link href="/login" className="text-accent hover:text-accent-hover">Sign in</Link>
        </span>
      }
    >
      <form className="space-y-4" aria-label="Register (disabled in demo mode)">
        <DisabledField id="username" label="Username" autoComplete="username" />
        <DisabledField id="email" label="Email" type="email" autoComplete="email" />
        <DisabledField id="password" label="Password" type="password" autoComplete="new-password" />
        <DisabledSubmit>CREATE ACCOUNT</DisabledSubmit>
      </form>
    </AuthShell>
  );
}
