import Link from "next/link";
import type { Route } from "next";
import type { Program } from "@/lib/programs";
import type { ProgramState } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { CheckIcon, ExternalIcon } from "./icons";

export interface ProgramChecklistItemProps {
  program: Program;
  state: ProgramState | undefined;
  onChange: (state: ProgramState | null) => void;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const STATE_BADGE = {
  done: { label: "Done", tone: "success" },
  skipped: { label: "Skipped", tone: "neutral" },
  todo: { label: "To do", tone: "info" },
} as const;

/** One carrier program in the setup checklist: what it is, how to sign up, and Done / Skip. */
export function ProgramChecklistItem({ program, state, onChange }: ProgramChecklistItemProps) {
  const badge = STATE_BADGE[state ?? "todo"];
  const host = hostOf(program.signupUrl);
  const headingId = `program-${program.id}`;
  const steps = program.emailAlerts.howToEnable;

  return (
    <li
      aria-labelledby={headingId}
      className={cx(
        "space-y-4 rounded-2xl border bg-surface p-4 shadow-sm sm:p-6",
        state === "done" ? "border-success/40" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={headingId} className="text-lg leading-snug font-semibold">
          {program.name}
        </h3>
        <Badge tone={badge.tone}>
          {state === "done" ? <CheckIcon className="size-3.5" /> : null}
          {badge.label}
        </Badge>
      </div>

      <p className="leading-relaxed">{program.shows}</p>

      <dl className="grid gap-3 text-sm leading-relaxed sm:grid-cols-2">
        <div>
          <dt className="font-semibold">
            {program.kind === "account" ? "What you need" : "How they check it\u2019s your home"}
          </dt>
          <dd className="text-muted">{program.verification}</dd>
        </div>
        <div className="space-y-3">
          <div>
            <dt className="font-semibold">How long it takes</dt>
            <dd className="text-muted">{program.setupTime}</dd>
          </div>
          <div>
            <dt className="font-semibold">Cost</dt>
            <dd className="text-muted">{program.cost}</dd>
          </div>
        </div>
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Button href={program.signupUrl} target="_blank" rel="noopener noreferrer" variant="secondary">
          {program.kind === "account" ? `Check settings on ${host}` : `Sign up on ${host}`}
          <ExternalIcon className="size-3.5" />
        </Button>
        {program.guideSlug ? (
          <Link
            href={`/guides/${program.guideSlug}` as Route}
            className="inline-flex min-h-10 items-center px-1 text-sm font-medium text-accent underline underline-offset-4 hover:no-underline"
          >
            Read our step-by-step guide
          </Link>
        ) : null}
      </div>

      {steps.length > 0 ? (
        <details className="group rounded-xl border border-border bg-subtle px-4 py-3" open={state === undefined}>
          <summary className="cursor-pointer font-semibold">Make sure email alerts are on</summary>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[0.9375rem] leading-relaxed">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </details>
      ) : null}

      {program.gotchas.length > 0 ? (
        <details className="rounded-xl border border-border px-4 py-3">
          <summary className="cursor-pointer font-semibold">Good to know</summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted marker:text-border-strong">
            {program.gotchas.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button
          size="sm"
          variant={state === "done" ? "primary" : "secondary"}
          aria-pressed={state === "done"}
          onClick={() => onChange(state === "done" ? null : "done")}
          aria-label={`Done: ${program.name}`}
        >
          <CheckIcon />
          Done
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={state === "skipped"}
          onClick={() => onChange(state === "skipped" ? null : "skipped")}
          aria-label={`Skip: ${program.name}`}
          className={state === "skipped" ? "bg-subtle" : undefined}
        >
          Skip
        </Button>
        <p className="text-sm text-muted" role="status">
          {state === "done"
            ? "Marked as done."
            : state === "skipped"
              ? "Skipped for now — you can come back to it."
              : ""}
        </p>
      </div>
    </li>
  );
}
