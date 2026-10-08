import type { HTMLAttributes, ReactNode } from "react";
import type { Tone } from "./Badge";
import { cx } from "./cx";

export interface CalloutProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: Tone;
  title?: ReactNode;
  /** Replace the default tone icon; pass `null` to hide it. */
  icon?: ReactNode;
  children?: ReactNode;
}

const TONES: Record<Tone, { box: string; icon: string }> = {
  neutral: { box: "border-border bg-subtle", icon: "text-muted" },
  info: { box: "border-accent/30 bg-accent-soft", icon: "text-accent" },
  success: { box: "border-success/30 bg-success-soft", icon: "text-success" },
  warning: { box: "border-warning/35 bg-warning-soft", icon: "text-warning" },
  danger: { box: "border-danger/30 bg-danger-soft", icon: "text-danger" },
};

function ToneIcon({ tone }: { tone: Tone }) {
  const common = {
    "aria-hidden": true,
    viewBox: "0 0 20 20",
    fill: "currentColor",
    className: "size-5",
  } as const;
  switch (tone) {
    case "success":
      return (
        <svg {...common}>
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.86-9.81a.75.75 0 0 0-1.22-.88l-3.24 4.48-1.63-1.63a.75.75 0 1 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.09l3.76-5.19Z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "warning":
    case "danger":
      return (
        <svg {...common}>
          <path
            fillRule="evenodd"
            d="M8.49 2.87c.67-1.16 2.35-1.16 3.02 0l6.28 10.88c.67 1.16-.17 2.62-1.51 2.62H3.72c-1.34 0-2.18-1.46-1.51-2.62L8.49 2.87ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clipRule="evenodd"
          />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.25v3a.75.75 0 0 0 1.5 0v-3.25A1.25 1.25 0 0 0 9.5 9H9Z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}

/**
 * A highlighted note. Static by default; pass role="status" or role="alert"
 * when it announces something that just happened.
 */
export function Callout({
  tone = "info",
  title,
  icon,
  className,
  children,
  ...rest
}: CalloutProps) {
  const styles = TONES[tone];
  const iconNode = icon === undefined ? <ToneIcon tone={tone} /> : icon;
  return (
    <div
      className={cx(
        "flex gap-3 rounded-2xl border p-4 text-[0.9375rem] leading-relaxed text-text",
        styles.box,
        className,
      )}
      {...rest}
    >
      {iconNode ? (
        <div className={cx("mt-0.5 shrink-0", styles.icon)}>{iconNode}</div>
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="space-y-2">{children}</div> : null}
      </div>
    </div>
  );
}
