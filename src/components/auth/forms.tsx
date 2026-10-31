"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
  updateUsernameAction,
  type FormState,
} from "@/server/auth-actions";

const INITIAL: FormState = { status: "idle", message: "" };

const LINK_ERRORS: Record<string, string> = {
  link_invalid: "That link is invalid or has expired. Request a new one.",
  not_configured: "Accounts are not connected on this deployment.",
};

export function Field({
  id,
  label,
  type = "text",
  autoComplete,
  errors,
  hint,
  defaultValue,
  required = true,
  maxLength,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  errors?: string[];
  hint?: string;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
}) {
  const describedBy = [hint ? `${id}-hint` : null, errors?.length ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-muted">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        maxLength={maxLength}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-fg focus:border-accent aria-[invalid=true]:border-danger"
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 font-mono text-sm font-semibold tracking-wider text-background transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  const ok = state.status === "success";
  const Icon = ok ? CheckCircle2 : CircleAlert;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${ok ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger"}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {state.message}
    </p>
  );
}

export function LoginForm() {
  const params = useSearchParams();
  const [state, action] = useActionState(signInAction, INITIAL);
  const linkError = LINK_ERRORS[params.get("error") ?? ""];
  return (
    <form action={action} className="space-y-4" noValidate>
      {linkError && state.status === "idle" ? <FormMessage state={{ status: "error", message: linkError }} /> : null}
      <FormMessage state={state} />
      <input type="hidden" name="next" value={params.get("next") ?? "/profile"} />
      <Field id="email" label="Email" type="email" autoComplete="email" errors={state.fieldErrors?.email} maxLength={254} />
      <Field id="password" label="Password" type="password" autoComplete="current-password" errors={state.fieldErrors?.password} maxLength={72} />
      <SubmitButton>SIGN IN</SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(signUpAction, INITIAL);
  if (state.status === "success") return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field
        id="username"
        label="Username"
        autoComplete="username"
        hint="Public on the leaderboard. 3–24 letters, digits or underscores."
        errors={state.fieldErrors?.username}
        maxLength={24}
      />
      <Field id="email" label="Email" type="email" autoComplete="email" errors={state.fieldErrors?.email} maxLength={254} />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        errors={state.fieldErrors?.password}
        maxLength={72}
      />
      <SubmitButton>CREATE ACCOUNT</SubmitButton>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordResetAction, INITIAL);
  if (state.status === "success") return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field id="email" label="Email" type="email" autoComplete="email" errors={state.fieldErrors?.email} maxLength={254} />
      <SubmitButton>SEND RESET LINK</SubmitButton>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, INITIAL);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field id="password" label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." errors={state.fieldErrors?.password} maxLength={72} />
      <Field id="confirm" label="Confirm password" type="password" autoComplete="new-password" errors={state.fieldErrors?.confirm} maxLength={72} />
      <SubmitButton>UPDATE PASSWORD</SubmitButton>
      {state.message.includes("expired") ? (
        <Link href="/reset-password" className="block text-sm text-accent hover:text-accent-hover">
          Request a new reset link
        </Link>
      ) : null}
    </form>
  );
}

export function UsernameForm({ current }: { current: string }) {
  const [state, action] = useActionState(updateUsernameAction, INITIAL);
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <Field id="username" label="Username" autoComplete="username" defaultValue={current} errors={state.fieldErrors?.username} maxLength={24} />
      <div className="sm:w-48">
        <SubmitButton>SAVE</SubmitButton>
      </div>
    </form>
  );
}
