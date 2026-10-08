import Link from "next/link";
import type { Route } from "next";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import {
  buttonClasses,
  isInternalHref,
  type ButtonSize,
  type ButtonVariant,
} from "./button-styles";

export type { ButtonSize, ButtonVariant };

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
}

export type ButtonAsButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
    /** Shows a spinner, sets aria-busy and disables the button. */
    loading?: boolean;
  };

export type ButtonAsLinkProps = CommonProps &
  Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "className" | "children" | "href"
  > & {
    /** Internal paths ("/setup", "#faq") use next/link; anything else renders a plain <a>. */
    href: string;
  };

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 animate-spin motion-reduce:animate-none"
      fill="none"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Button with variants and sizes. Renders a <button> by default, a Next
 * <Link> for internal `href`s and a plain <a> for external ones (external
 * links opened in a new tab get rel="noopener noreferrer").
 */
export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { href, variant, size, className, children, rel, target, ...rest } =
      props;
    const classes = buttonClasses({ variant, size, className });
    if (isInternalHref(href)) {
      return (
        <Link
          href={href as Route}
          className={classes}
          rel={rel}
          target={target}
          {...rest}
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        className={classes}
        target={target}
        rel={target === "_blank" ? (rel ?? "noopener noreferrer") : rel}
        {...rest}
      >
        {children}
      </a>
    );
  }

  const {
    variant,
    size,
    className,
    children,
    loading = false,
    disabled,
    type = "button",
    ...rest
  } = props;
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
