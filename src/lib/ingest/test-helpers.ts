import type { InboundEmail } from "@/lib/types";

/** An InboundEmail for tests: auto-forwarded to r-testalias0001@in.example.com unless overridden. */
export function makeEmail(fields: Partial<InboundEmail> = {}): InboundEmail {
  return {
    recipients: ["r-testalias0001@in.example.com"],
    from: "someone@example.com",
    fromName: null,
    subject: "",
    text: "",
    html: "",
    headers: {},
    date: "2026-10-08T14:00:00.000Z",
    ...fields,
  };
}
