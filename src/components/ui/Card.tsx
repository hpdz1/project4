import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Element to render (default "div"). */
  as?: "div" | "section" | "article" | "li" | "aside";
  /** "accent" adds a tinted background for call-to-action cards. */
  tone?: "default" | "accent";
  padding?: "none" | "sm" | "md" | "lg";
  children?: ReactNode;
}

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
} as const;

/** A bordered surface for grouping related content. */
export function Card({
  as: Tag = "div",
  tone = "default",
  padding = "md",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cx(
        "rounded-2xl border shadow-sm",
        tone === "accent"
          ? "border-accent/30 bg-accent-soft"
          : "border-border bg-surface",
        PADDING[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
