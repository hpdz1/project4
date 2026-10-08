/** Small decorative icons (aria-hidden; pair them with text). */
interface IconProps {
  className?: string;
}

const base = { "aria-hidden": true, viewBox: "0 0 20 20", fill: "currentColor" } as const;

export function LockIcon({ className = "size-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function CheckIcon({ className = "size-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ExternalIcon({ className = "size-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M11 3a1 1 0 1 0 0 2h2.59l-6.3 6.3a1 1 0 1 0 1.42 1.4L15 6.42V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
      <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
    </svg>
  );
}

export function TruckIcon({ className = "size-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1h2.38a2 2 0 0 1 1.79 1.1l1.62 3.24A2 2 0 0 1 19 11.24V14a2 2 0 0 1-2 2h-.27a2.5 2.5 0 0 1-4.46 0H7.73a2.5 2.5 0 0 1-4.46 0H3a1 1 0 0 1-1-1V5Zm11 3v3h4.38l-1.5-3H13ZM5.5 15.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </svg>
  );
}

export function MailIcon({ className = "size-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 4a2 2 0 0 0-2 2v.38l9 4.5 9-4.5V6a2 2 0 0 0-2-2H3Z" />
      <path d="m19 8.62-8.55 4.27a1 1 0 0 1-.9 0L1 8.62V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.62Z" />
    </svg>
  );
}

export function RadarIcon({ className = "size-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 2a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V2Z" opacity="0.6" />
      <path d="M10 6a4 4 0 1 0 4 4h-2a2 2 0 1 1-2-2V6Z" />
      <path d="M10 2v8l5.66-5.66A7.97 7.97 0 0 0 10 2Z" />
    </svg>
  );
}

export function RefreshIcon({ className = "size-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        fillRule="evenodd"
        d="M15.31 4.69A7 7 0 0 0 3.2 8.6a1 1 0 1 0 1.95.42 5 5 0 0 1 8.73-2.9L12.5 7.5a.5.5 0 0 0 .35.85H16.5a.5.5 0 0 0 .5-.5V4.2a.5.5 0 0 0-.85-.35l-.84.84ZM16.8 11.4a1 1 0 0 0-1.2.76 5 5 0 0 1-8.48 2.72L8.5 13.5a.5.5 0 0 0-.35-.85H4.5a.5.5 0 0 0-.5.5v3.65a.5.5 0 0 0 .85.35l.84-.84A7 7 0 0 0 17.56 12.6a1 1 0 0 0-.76-1.2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
