import type { Metadata } from "next";
import Link from "next/link";
import { getConfigState } from "@/lib/app-config";
import { AuthShell, DisabledField, DisabledSubmit } from "@/components/auth/auth-shell";
import { ResetRequestForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  const { accountsEnabled } = getConfigState();
  return (
    <AuthShell
      title="Reset password"
      subtitle="We'll email you a secure reset link."
      enabled={accountsEnabled}
      footer={<Link href="/login" className="text-accent hover:text-accent-hover">Back to sign in</Link>}
    >
      {accountsEnabled ? (
        <ResetRequestForm />
      ) : (
        <form className="space-y-4" aria-label="Reset password (disabled)">
          <DisabledField id="email" label="Email" type="email" autoComplete="email" />
          <DisabledSubmit>SEND RESET LINK</DisabledSubmit>
        </form>
      )}
    </AuthShell>
  );
}
