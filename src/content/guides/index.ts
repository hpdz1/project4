/**
 * Guide articles (publisher content for /guides). Each article lives in
 * `<slug>.tsx` and exports `meta` plus a default `Content` component that
 * returns semantic HTML only; the guide page renders the title, dates,
 * breadcrumbs and calls to action around it.
 */
import type { JSX } from "react";
import * as fakeDeliveryTextScams from "./fake-delivery-text-scams";
import * as fedexDeliveryManager from "./fedex-delivery-manager";
import * as howToSeeEveryPackage from "./how-to-see-every-package-coming-to-your-address";
import * as packageSaysDelivered from "./package-says-delivered-but-not-here";
import * as parcelNotificationsAmericasMea from "./parcel-notifications-americas-middle-east-africa";
import * as parcelNotificationsAsiaPacific from "./parcel-notifications-asia-pacific";
import * as parcelNotificationsEurope from "./parcel-notifications-europe";
import * as packageYouDidntOrder from "./package-you-didnt-order";
import * as trackWithoutNumber from "./track-a-package-without-a-tracking-number";
import type { Guide, GuideMeta } from "./types";
import * as upsMyChoice from "./ups-my-choice";
import * as uspsInformedDelivery from "./usps-informed-delivery";

export type { Guide, GuideCategory, GuideMeta } from "./types";

interface GuideModule {
  meta: GuideMeta;
  default: () => JSX.Element;
}

function toGuide(mod: GuideModule): Guide {
  return { meta: mod.meta, Content: mod.default };
}

/** Every guide, in the order the index page lists them. */
export const GUIDES: Guide[] = [
  howToSeeEveryPackage,
  trackWithoutNumber,
  uspsInformedDelivery,
  upsMyChoice,
  fedexDeliveryManager,
  fakeDeliveryTextScams,
  packageYouDidntOrder,
  packageSaysDelivered,
  parcelNotificationsEurope,
  parcelNotificationsAsiaPacific,
  parcelNotificationsAmericasMea,
].map(toGuide);

const GUIDES_BY_SLUG: ReadonlyMap<string, Guide> = new Map(
  GUIDES.map((guide) => [guide.meta.slug, guide]),
);

/** The guide with this slug, or undefined when there is none. */
export function getGuide(slug: string): Guide | undefined {
  return GUIDES_BY_SLUG.get(slug);
}
