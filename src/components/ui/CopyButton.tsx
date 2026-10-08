"use client";

import { useEffect, useRef, useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";

export interface CopyButtonProps {
  /** The text placed on the clipboard. */
  text: string;
  /** Visible label (default "Copy"). */
  label?: string;
  /** Label shown for a moment after copying (default "Copied"). */
  copiedLabel?: string;
  /** Accessible name when the visible label is ambiguous, e.g. "Copy your forwarding address". */
  "aria-label"?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  onCopied?: () => void;
}

type CopyState = "idle" | "copied" | "failed";

const RESET_AFTER_MS = 2000;

/** Copy via the async Clipboard API, falling back to a hidden textarea. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.pointerEvents = "none";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Copies `text` to the clipboard and briefly shows "Copied". */
export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  "aria-label": ariaLabel,
  variant = "secondary",
  size = "sm",
  className,
  onCopied,
}: CopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function handleClick() {
    const ok = await copyText(text);
    setState(ok ? "copied" : "failed");
    if (ok) onCopied?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), RESET_AFTER_MS);
  }

  const visible =
    state === "copied" ? copiedLabel : state === "failed" ? "Copy failed" : label;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        aria-label={state === "idle" ? ariaLabel : undefined}
      >
        {state === "copied" ? (
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h6A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5H14V8.5A2.5 2.5 0 0 0 11.5 6H7V3.5Z" />
            <path d="M4.5 7A1.5 1.5 0 0 0 3 8.5v8A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 11.5 7h-7Z" />
          </svg>
        )}
        {visible}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied"
          ? "Copied to clipboard"
          : state === "failed"
            ? "Could not copy. Select the text and copy it manually."
            : ""}
      </span>
    </>
  );
}
