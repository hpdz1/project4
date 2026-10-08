/** Serialize structured data for a <script> tag, escaping "<" so it can't close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
