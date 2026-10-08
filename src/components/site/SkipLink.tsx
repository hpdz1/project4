/** Visually hidden until focused; jumps keyboard users past the header. */
export function SkipLink({ targetId = "main" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only rounded-lg bg-accent font-semibold text-accent-contrast shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2"
    >
      Skip to content
    </a>
  );
}
