"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { REGIONS } from "@/config/regions";
import { DIFFICULTIES, DIFFICULTY_LABEL } from "@/lib/challenge-types";
import { MAX_ADMIN_FLAG_LENGTH, adminCreateSchema, parseTags, type AdminChallengeFields } from "@/lib/admin-validation";

const input = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-fg focus:border-accent";
const labelCls = "mb-1 block font-mono text-[11px] uppercase tracking-wider text-muted";

export function ChallengeEditor({
  id,
  initial,
  hasFlag,
}: {
  /** null when creating */
  id: string | null;
  initial?: AdminChallengeFields;
  hasFlag: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const flag = String(fd.get("flag") ?? "");
    const payload = {
      slug: String(fd.get("slug") ?? ""),
      region: String(fd.get("region") ?? ""),
      title: String(fd.get("title") ?? ""),
      summary: String(fd.get("summary") ?? ""),
      description: String(fd.get("description") ?? ""),
      category: String(fd.get("category") ?? ""),
      tags: parseTags(String(fd.get("tags") ?? "")),
      difficulty: String(fd.get("difficulty") ?? ""),
      points: Number(fd.get("points")),
      requiresEvidence: fd.get("requiresEvidence") === "on",
      isSample: fd.get("isSample") === "on",
      ...(flag.trim() ? { flag } : {}),
    };
    const parsed = adminCreateSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) (errs[String(issue.path[0])] ??= []).push(issue.message);
      setFieldErrors(errs);
      setMessage({ ok: false, text: "Check the highlighted fields." });
      return;
    }
    setFieldErrors({});
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch(id ? `/api/v1/admin/challenges/${id}` : "/api/v1/admin/challenges", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        credentials: "same-origin",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setFieldErrors(body?.error?.details ?? {});
        setMessage({ ok: false, text: body?.error?.message ?? "Save failed." });
        return;
      }
      (e.target as HTMLFormElement).querySelector<HTMLInputElement>("#flag")!.value = "";
      if (!id) {
        router.push(`/admin/challenges/${body.data.id}?created=1`);
      } else {
        setMessage({ ok: true, text: "Saved." });
        router.refresh();
      }
    } catch {
      setMessage({ ok: false, text: "Network error." });
    } finally {
      setPending(false);
    }
  }

  const err = (k: string) =>
    fieldErrors[k]?.length ? (
      <p id={`${k}-error`} className="mt-1 text-xs text-danger">
        {fieldErrors[k]!.join(" ")}
      </p>
    ) : null;
  const aria = (k: string) => (fieldErrors[k]?.length ? { "aria-invalid": true, "aria-describedby": `${k}-error` } : {});

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-5 rounded-xl border border-border bg-surface p-5 sm:p-6" noValidate>
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={`flex items-center gap-2 text-sm ${message.ok ? "text-success" : "text-danger"}`}>
          {message.ok ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <CircleAlert className="size-4" aria-hidden="true" />}
          {message.text}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="title" className={labelCls}>Title</label>
          <input id="title" name="title" required maxLength={120} defaultValue={initial?.title} className={input} {...aria("title")} />
          {err("title")}
        </div>
        <div>
          <label htmlFor="slug" className={labelCls}>Slug (URL)</label>
          <input id="slug" name="slug" required maxLength={80} defaultValue={initial?.slug} placeholder="the-frozen-memory" className={`${input} font-mono`} {...aria("slug")} />
          {err("slug")}
        </div>
        <div>
          <label htmlFor="region" className={labelCls}>Region / domain</label>
          <select id="region" name="region" defaultValue={initial?.region ?? "antarctica"} className={input}>
            {REGIONS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name} — {r.forensicDomain}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="difficulty" className={labelCls}>Difficulty</label>
            <select id="difficulty" name="difficulty" defaultValue={initial?.difficulty ?? "easy"} className={input}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="points" className={labelCls}>Points</label>
            <input id="points" name="points" type="number" min={1} max={10000} required defaultValue={initial?.points ?? 100} className={`${input} font-mono`} {...aria("points")} />
            {err("points")}
          </div>
        </div>
        <div>
          <label htmlFor="category" className={labelCls}>Category</label>
          <input id="category" name="category" maxLength={60} defaultValue={initial?.category} placeholder="Memory Analysis" className={input} />
        </div>
        <div>
          <label htmlFor="tags" className={labelCls}>Tags (comma separated)</label>
          <input id="tags" name="tags" defaultValue={initial?.tags.join(", ")} placeholder="windows, volatility" className={input} {...aria("tags")} />
          {err("tags")}
        </div>
      </div>
      <div>
        <label htmlFor="summary" className={labelCls}>Summary (cards, ≤300 chars)</label>
        <input id="summary" name="summary" maxLength={300} defaultValue={initial?.summary} className={input} />
      </div>
      <div>
        <label htmlFor="description" className={labelCls}>Briefing (blank line = new paragraph)</label>
        <textarea id="description" name="description" rows={8} maxLength={20000} defaultValue={initial?.description} className={input} />
      </div>
      <div>
        <label htmlFor="flag" className={labelCls}>{hasFlag ? "Replace flag (leave empty to keep the current flag)" : "Flag"}</label>
        <input
          id="flag"
          name="flag"
          type="password"
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_ADMIN_FLAG_LENGTH}
          placeholder={hasFlag ? "•••••••• (set)" : "DEADBYTE{...}"}
          className={`${input} font-mono`}
          aria-describedby="flag-hint"
          {...aria("flag")}
        />
        <p id="flag-hint" className="mt-1 text-xs text-muted">
          Stored only as an HMAC-SHA256 digest; it can never be displayed again. Surrounding whitespace is trimmed; case is preserved.
        </p>
        {err("flag")}
      </div>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className={labelCls}>Publishing rules</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="requiresEvidence" defaultChecked={initial?.requiresEvidence ?? true} /> Requires verified evidence before publishing
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isSample" defaultChecked={initial?.isSample ?? false} /> Sample / testing-only content (labelled publicly)
        </label>
      </fieldset>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2 font-mono text-sm font-semibold tracking-wider text-background hover:bg-accent-hover disabled:opacity-70"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {id ? "SAVE CHANGES" : "CREATE DRAFT"}
        </button>
      </div>
    </form>
  );
}
