import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { SkipLink } from "@/components/site/SkipLink";
import {
  ADSENSE_CLIENT,
  DEFAULT_TITLE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  adsEnabled,
  adsenseScriptSrc,
} from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Don't let phones turn postcodes or tracking numbers into phone/map links.
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary", title: DEFAULT_TITLE, description: SITE_DESCRIPTION },
  ...(ADSENSE_CLIENT
    ? { other: { "google-adsense-account": ADSENSE_CLIENT } }
    : {}),
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111a2b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // English only, for visitors in every country: browsers offer to translate
  // pages whose declared language differs from the user's, so lang="en" must
  // stay accurate. Values that must not be translated (brand name, forwarding
  // addresses, filter queries, tracking numbers, codes) carry translate="no".
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          AdSense loader: a plain async script in the server-rendered <head>
          (not next/script, which injects client-side). Only in production
          builds with NEXT_PUBLIC_ADSENSE_CLIENT set. Use manual units
          (<AdSlot>) and keep Auto ads formats off in the AdSense dashboard:
          this script also loads on 404/error screens, where ads are not allowed.
        */}
        {adsEnabled && ADSENSE_CLIENT ? (
          <script
            async
            src={adsenseScriptSrc(ADSENSE_CLIENT)}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body className="flex min-h-full flex-col bg-bg font-sans text-text">
        <SkipLink />
        <Header />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
