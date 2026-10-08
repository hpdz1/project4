import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "header" | "footer" | "nav" | "article";
  /** narrow ≈ reading width, default ≈ app width, wide for grids. */
  size?: "narrow" | "default" | "wide";
  children?: ReactNode;
}

const SIZES = {
  narrow: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-6xl",
} as const;

/** Centered, padded page column (16px gutters on phones). */
export function Container({
  as: Tag = "div",
  size = "default",
  className,
  children,
  ...rest
}: ContainerProps) {
  return (
    <Tag
      className={cx("mx-auto w-full px-4 sm:px-6", SIZES[size], className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
