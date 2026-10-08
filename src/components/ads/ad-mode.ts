import { ADSENSE_CLIENT, adsEnabled, showAdPlaceholders } from "@/lib/site";

/** What an ad slot should render: a real AdSense unit, a dev placeholder, or nothing. */
export type AdMode = "ad" | "placeholder" | "none";

export interface AdModeInput {
  slot: string | undefined;
  client: string | null;
  /** Production build with a valid client id. */
  enabled: boolean;
  /** Development with NEXT_PUBLIC_SHOW_AD_PLACEHOLDERS=1. */
  placeholders: boolean;
}

/** Pure decision used by <AdSlot>; exported for tests and server code. */
export function resolveAdMode(input: AdModeInput): AdMode {
  const slot = input.slot?.trim();
  if (input.enabled && input.client && slot) return "ad";
  if (input.placeholders) return "placeholder";
  return "none";
}

/**
 * Server-safe check for whether `<AdSlot slot={slot}>` would render anything
 * with the current build's configuration. Use it to skip wrapper markup
 * around an ad when no ad will show.
 */
export function adModeFor(slot: string | undefined): AdMode {
  return resolveAdMode({
    slot,
    client: ADSENSE_CLIENT,
    enabled: adsEnabled,
    placeholders: showAdPlaceholders,
  });
}

/** Shorthand for `adModeFor(slot) !== "none"`. */
export function shouldRenderAd(slot: string | undefined): boolean {
  return adModeFor(slot) !== "none";
}
