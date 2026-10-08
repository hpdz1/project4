"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT } from "@/lib/site";
import { cx } from "@/components/ui/cx";
import { adModeFor } from "./ad-mode";

export interface AdSlotProps {
  /** AdSense ad-unit id, usually from AD_SLOTS. Undefined renders nothing. */
  slot: string | undefined;
  /** Reserved height in px so the page doesn't jump when the ad loads (CLS). */
  minHeight?: number;
  className?: string;
}

type AdsWindow = Window & { adsbygoogle?: unknown[] };

/**
 * A manual, responsive AdSense unit.
 *
 * Renders nothing unless ads are enabled (production + valid client id) and a
 * slot id is given. In development with NEXT_PUBLIC_SHOW_AD_PLACEHOLDERS=1 it
 * renders a dashed placeholder instead.
 *
 * Placement rules (AdSense policy): only on screens with real publisher
 * content, never on error/404/empty screens, never next to buttons, links
 * lists or navigation. The wrapper carries generous vertical margin and an
 * "Advertisement" label for that reason.
 */
export function AdSlot({ slot, minHeight = 280, className }: AdSlotProps) {
  const pathname = usePathname();
  const mode = adModeFor(slot);
  if (mode === "none") return null;

  return (
    <aside
      aria-label="Advertisement"
      className={cx("my-12 border-y border-border py-4 sm:my-16", className)}
    >
      <p className="mb-2 text-center text-xs tracking-wide text-muted uppercase">
        Advertisement
      </p>
      <div style={{ minHeight }} className="w-full">
        {mode === "ad" && slot && ADSENSE_CLIENT ? (
          // A fresh <ins> per route, so client-side navigation gets a new unit.
          <AdUnit key={pathname} client={ADSENSE_CLIENT} slot={slot} />
        ) : (
          <div
            style={{ minHeight }}
            className="flex w-full items-center justify-center rounded-xl border-2 border-dashed border-border-strong text-sm text-muted"
          >
            Ad placeholder
          </div>
        )}
      </div>
    </aside>
  );
}

function AdUnit({ client, slot }: { client: string; slot: string }) {
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Push exactly once per <ins>. React StrictMode runs effects twice on the
    // same DOM node, so the guard lives on the element, not in a ref.
    if (el.dataset.prPushed === "1" || el.hasAttribute("data-adsbygoogle-status")) {
      return;
    }
    el.dataset.prPushed = "1";
    try {
      const w = window as AdsWindow;
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {
      // adsbygoogle throws TagError for e.g. zero-width containers; never break the page.
    }
  }, []);

  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
