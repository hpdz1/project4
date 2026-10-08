"use client";

import { useId, type Ref } from "react";
import { Callout } from "@/components/ui/Callout";
import { CopyButton } from "@/components/ui/CopyButton";

export interface SignInLinkCalloutProps {
  /** The full personal sign-in link (`<origin>/signin#key=…`). */
  link: string;
  title?: string;
  /** Extra sentence, e.g. that the previous link stopped working. */
  note?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Shows a freshly created sign-in link once, with a copy button and an
 * honest warning. Focusable so the page can move focus to it.
 */
export function SignInLinkCallout({
  link,
  title = "Save your personal sign-in link",
  note,
  ref,
}: SignInLinkCalloutProps) {
  const inputId = useId();
  return (
    <div ref={ref} tabIndex={-1} className="rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-accent">
      <Callout tone="warning" title={title}>
        <p>
          Use this link to open your radar on another phone or computer. Anyone who has it can see your package list,
          so keep it private — save it in your password manager or notes. We only show it once and can&apos;t recover
          it; if you lose it, you can make a new one from your dashboard settings on this device.
        </p>
        {note ? <p>{note}</p> : null}
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor={inputId}>
            Your sign-in link
          </label>
          <input
            id={inputId}
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-10 w-full min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-3 font-mono text-sm text-text"
          />
          <CopyButton text={link} label="Copy link" aria-label="Copy link: your sign-in link" className="shrink-0" />
        </div>
      </Callout>
    </div>
  );
}
