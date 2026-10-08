import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-colors select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-contrast shadow-sm hover:bg-accent-hover disabled:hover:bg-accent",
  secondary:
    "border border-border-strong bg-surface text-text hover:bg-subtle disabled:hover:bg-surface",
  ghost: "text-accent hover:bg-accent-soft disabled:hover:bg-transparent",
  danger:
    "bg-danger text-danger-contrast shadow-sm hover:bg-danger-hover disabled:hover:bg-danger",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-sm",
  md: "min-h-11 px-4 py-2 text-[0.9375rem]",
  lg: "min-h-12 px-6 py-3 text-base",
};

/** Class string for button-styled elements (e.g. a <label> or custom link). */
export function buttonClasses(
  options: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {},
): string {
  const { variant = "primary", size = "md", className } = options;
  return cx(BASE, VARIANTS[variant], SIZES[size], className);
}

/** True for same-site paths and in-page anchors, which should use next/link. */
export function isInternalHref(href: string): boolean {
  return (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#");
}
