"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/button-styles";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Danger styling for destructive actions. */
  destructive?: boolean;
  busy?: boolean;
  /** Error from the confirmed action, shown inside the dialog. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A modal confirmation built on the native <dialog> element, which handles
 * the focus trap, Escape and the inert background. Focus starts on Cancel so
 * a stray Enter never confirms a destructive action.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/50"
    >
      <div className="space-y-4 p-6">
        <h2 id={`${id}-title`} className="text-xl font-bold">
          {title}
        </h2>
        <div id={`${id}-body`} className="space-y-3 text-[0.9375rem] leading-relaxed text-muted">
          {children}
        </div>
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={buttonClasses({ variant: "secondary" })}
          >
            {cancelLabel}
          </button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
