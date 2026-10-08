import { serializeJsonLd } from "./json-ld";

/** Renders schema.org JSON-LD as a native script tag (per the Next.js JSON-LD guide). */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
