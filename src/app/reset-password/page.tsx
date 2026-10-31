import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, DisabledField, DisabledSubmit } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      subtitle="We'll email you a secure reset link."
      footer={<Link href="/login" className="text-accent hover:text-accent-hover">Back to sign in</Link>}
    >
      <form className="space-y-4" aria-label="Reset password (disabled in demo mode)">
        <DisabledField id="email" label="Email" type="email" autoComplete="email" />
        <DisabledSubmit>SEND RESET LINK</DisabledSubmit>
      </form>
    </AuthShell>
  );
}
