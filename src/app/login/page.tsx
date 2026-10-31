import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, DisabledField, DisabledSubmit } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Resume your investigation."
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <Link href="/register" className="text-accent hover:text-accent-hover">Create an account</Link>
          <Link href="/reset-password" className="hover:text-fg">Forgot password?</Link>
        </div>
      }
    >
      <form className="space-y-4" aria-label="Sign in (disabled in demo mode)">
        <DisabledField id="email" label="Email" type="email" autoComplete="email" />
        <DisabledField id="password" label="Password" type="password" autoComplete="current-password" />
        <DisabledSubmit>SIGN IN</DisabledSubmit>
      </form>
    </AuthShell>
  );
}
