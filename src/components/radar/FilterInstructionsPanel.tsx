"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { ProgramId } from "@/lib/types";
import { EMAIL_PROVIDERS, buildFilterInstructions, type EmailProvider } from "@/lib/programs";
import { loadProvider, saveProvider } from "@/lib/client/saved-location";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { CopyButton } from "@/components/ui/CopyButton";
import { cx } from "@/components/ui/cx";
import { ExternalIcon } from "./icons";

const SHORT_LABELS: Record<EmailProvider, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  yahoo: "Yahoo",
  icloud: "iCloud",
  other: "Other",
};

export interface FilterInstructionsPanelProps {
  inboundAddress: string;
  programIds: ProgramId[];
  country?: string | null;
}

/**
 * Provider tabs (Gmail, Outlook, Yahoo, iCloud, Other) with step-by-step
 * instructions for forwarding only the carriers' emails. Follows the ARIA
 * tabs pattern: arrow keys move between tabs, Tab moves into the panel.
 */
export function FilterInstructionsPanel({ inboundAddress, programIds, country }: FilterInstructionsPanelProps) {
  const id = useId();
  const [provider, setProvider] = useState<EmailProvider>(() => loadProvider() ?? "gmail");
  const tabRefs = useRef<Partial<Record<EmailProvider, HTMLButtonElement | null>>>({});

  const instructions = buildFilterInstructions(provider, inboundAddress, programIds, { country });

  function select(next: EmailProvider, focus = false) {
    setProvider(next);
    saveProvider(next);
    if (focus) tabRefs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const ids = EMAIL_PROVIDERS.map((p) => p.id);
    const at = ids.indexOf(provider);
    let next: EmailProvider | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = ids[(at + 1) % ids.length];
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = ids[(at - 1 + ids.length) % ids.length];
    else if (event.key === "Home") next = ids[0];
    else if (event.key === "End") next = ids[ids.length - 1];
    if (next) {
      event.preventDefault();
      select(next, true);
    }
  }

  const panelId = `${id}-panel`;
  const tabId = (p: EmailProvider) => `${id}-tab-${p}`;

  return (
    <div className="space-y-5">
      <div>
        <p id={`${id}-label`} className="mb-2 text-sm font-semibold">
          Which email do your carrier alerts go to?
        </p>
        <div
          role="tablist"
          aria-labelledby={`${id}-label`}
          className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-subtle p-1.5"
        >
          {EMAIL_PROVIDERS.map((p) => {
            const selected = p.id === provider;
            return (
              <button
                key={p.id}
                ref={(el) => {
                  tabRefs.current[p.id] = el;
                }}
                type="button"
                role="tab"
                id={tabId(p.id)}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                title={p.label}
                onClick={() => select(p.id)}
                onKeyDown={onKeyDown}
                className={cx(
                  "min-h-10 flex-1 rounded-xl px-3 text-sm font-semibold whitespace-nowrap transition-colors",
                  selected ? "bg-surface text-text shadow-sm ring-1 ring-border-strong" : "text-muted hover:bg-surface/60 hover:text-text",
                )}
              >
                {SHORT_LABELS[p.id]}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={tabId(provider)} tabIndex={0} className="space-y-5 rounded-2xl outline-none">
        <h3 className="text-lg font-semibold">{instructions.label}</h3>

        {instructions.verificationNote ? (
          <Callout tone="info" title="You'll confirm the address once">
            <p>{instructions.verificationNote}</p>
          </Callout>
        ) : null}

        <ol className="space-y-3">
          {instructions.steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent"
              >
                {i + 1}
              </span>
              <span className="min-w-0 pt-0.5 leading-relaxed [overflow-wrap:anywhere]">
                <span className="sr-only">Step {i + 1}: </span>
                {step}
              </span>
            </li>
          ))}
        </ol>

        {instructions.filterQuery ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">The filter&apos;s From value</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <code className="block min-w-0 flex-1 rounded-xl border border-border bg-subtle p-3 font-mono text-sm leading-relaxed [overflow-wrap:anywhere]">
                {instructions.senders.join(" OR ")}
              </code>
              <CopyButton
                text={instructions.senders.join(" OR ")}
                label="Copy"
                aria-label="Copy the filter's From value"
                className="shrink-0"
              />
            </div>
            <details className="text-sm text-muted">
              <summary className="cursor-pointer py-1 font-medium text-accent">Prefer a Gmail search query?</summary>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                <code className="block min-w-0 flex-1 rounded-xl border border-border bg-subtle p-3 font-mono text-sm text-text [overflow-wrap:anywhere]">
                  {instructions.filterQuery}
                </code>
                <CopyButton text={instructions.filterQuery} label="Copy query" className="shrink-0" />
              </div>
            </details>
          </div>
        ) : instructions.senders.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Carrier sender addresses</p>
            <ul className="space-y-1 rounded-xl border border-border bg-subtle p-3 font-mono text-sm">
              {instructions.senders.map((s) => (
                <li key={s} className="[overflow-wrap:anywhere]">
                  {s}
                </li>
              ))}
            </ul>
            <CopyButton
              text={instructions.senders.join(", ")}
              label="Copy all addresses"
              aria-label="Copy all addresses (carrier senders)"
            />
          </div>
        ) : null}

        {instructions.links.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {instructions.links.map((link) => (
              <Button
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
                size="sm"
                className="whitespace-normal!"
              >
                {link.label}
                <ExternalIcon className="size-3.5 shrink-0" />
              </Button>
            ))}
          </div>
        ) : null}

        {instructions.caveats.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Good to know</p>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted marker:text-border-strong">
              {instructions.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
