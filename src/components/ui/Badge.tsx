import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  children?: ReactNode;
}

const TONES: Record<Tone, string> = {
  neutral: "border-border bg-subtle text-muted",
  info: "border-accent/25 bg-accent-soft text-accent",
  success: "border-success/25 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-danger/25 bg-danger-soft text-danger",
};

/** Small status label. Pair color with text — never rely on color alone. */
export function Badge({
  tone = "neutral",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
