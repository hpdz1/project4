import type { NextConfig } from "next";

/**
 * Security headers for every response. Deliberately NOT restricting
 * script-src/frame-src/connect-src: AdSense loads scripts and iframes from
 * many Google hosts. Referrer-Policy must not be `no-referrer`, or AdSense
 * may not serve (it needs the referrer on cross-origin requests).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  // node:sqlite is a Node built-in loaded at runtime by src/lib/store, so it
  // needs no serverExternalPackages entry.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
