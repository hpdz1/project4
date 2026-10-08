import { cx } from "@/components/ui/cx";

/** The radar mark (decorative; pair it with the visible site name). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className={cx("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="9" className="fill-accent" />
      <g fill="none" className="stroke-accent-contrast" strokeLinecap="round">
        <path d="M9 23a10 10 0 0 1 14-14" strokeWidth="2.2" opacity="0.55" />
        <path d="M12.5 19.5a5 5 0 0 1 7-7" strokeWidth="2.2" opacity="0.8" />
        <path d="M16 16l7.5-7.5" strokeWidth="2.2" />
      </g>
      <circle cx="16" cy="16" r="2.6" className="fill-accent-contrast" />
    </svg>
  );
}
