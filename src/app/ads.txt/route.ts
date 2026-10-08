import { adsensePublisherId } from "@/lib/site";

/** Google's TAG certification authority id, as in AdSense's generated ads.txt line. */
const GOOGLE_TAG_ID = "f08c47fec0942fa0";

/**
 * /ads.txt for AdSense, built from NEXT_PUBLIC_ADSENSE_CLIENT.
 * 404 when no valid publisher id is configured.
 */
export async function GET(): Promise<Response> {
  const publisherId = adsensePublisherId();
  if (!publisherId) {
    return new Response("Not found\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(`google.com, ${publisherId}, DIRECT, ${GOOGLE_TAG_ID}\n`, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
