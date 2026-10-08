/**
 * Carrier programs users turn on once so carriers email them about packages.
 *
 * Facts come from the research notes (programs.md with its fact-check,
 * carrier-emails.md, forwarding.md, market-scan.md). URLs are the INDEXED /
 * DOCUMENTED ones; where only a deep link was unverified we use the base
 * page. Sender addresses are the ones seen in real carrier emails (or in the
 * Home Assistant "Mail and Packages" sender lists those notes cite). Exact
 * addresses rather than whole domains keep unrelated mail (account codes,
 * receipts) out of the forwarding filter.
 */
import type { CarrierId, ProgramId } from "@/lib/types";

export interface Program {
  id: ProgramId;
  name: string;
  operator: string;
  carrier: CarrierId | null;
  /** ISO 3166-1 alpha-2 codes where the program is offered (among the countries we cover). */
  countries: string[];
  /** address = shows everything headed to your verified address; account = tied to your login/email; per_package = one shipment at a time. */
  kind: "address" | "account" | "per_package";
  /** One plain sentence. */
  shows: string;
  cost: string;
  signupUrl: string;
  dashboardUrl: string | null;
  /** How the program checks who you are, including mailed codes and waits. */
  verification: string;
  setupTime: string;
  emailAlerts: {
    /** Steps to turn on email alerts in the program (empty when it has none). */
    howToEnable: string[];
    /** Lowercase sender addresses to forward, for the default country. */
    senders: string[];
    /** Per-country sender lists that replace `senders` (e.g. amazon.co.uk in GB). */
    sendersByCountry?: Partial<Record<string, string[]>>;
  };
  /** "full": we parse status, dates and shippers; "basic": we only pick up tracking numbers. */
  parserSupport: "full" | "basic";
  gotchas: string[];
  guideSlug: "usps-informed-delivery" | "ups-my-choice" | "fedex-delivery-manager" | null;
}

/** Countries where we list the international programs (UPS, FedEx, DHL Express, Amazon). */
const INTERNATIONAL = ["US", "CA", "GB", "AU", "DE", "NL"];

function amazonSenders(domain: string, localParts = ["shipment-tracking", "order-update", "auto-confirm"]): string[] {
  return localParts.map((local) => `${local}@${domain}`);
}

/** Keyed by id so the compiler checks every ProgramId has exactly one entry. */
export const PROGRAMS_BY_ID: Readonly<Record<ProgramId, Program>> = {
  usps_informed_delivery: {
    id: "usps_informed_delivery",
    name: "USPS Informed Delivery",
    operator: "USPS",
    carrier: "usps",
    countries: ["US"],
    kind: "address",
    shows:
      "USPS packages addressed to your home, including ones you didn't order, plus a morning email with scans of the letter-size mail arriving soon.",
    cost: "Free",
    signupUrl: "https://informeddelivery.usps.com/",
    dashboardUrl: "https://informeddelivery.usps.com/box/pages/secure/DashboardAction_input.action",
    verification:
      "You need a USPS.com account and must prove you live at the address: an online identity check first, and if that fails, a code mailed to the address or a visit to a Post Office with photo ID. USPS also mails a notice to the address when someone signs up.",
    setupTime:
      "About 10 minutes online; if the online identity check fails, a code is mailed to you (usually 3–7 business days)",
    emailAlerts: {
      howToEnable: [
        "Sign in at informeddelivery.usps.com and open Settings.",
        "Make sure the Daily Digest email is turned on.",
        "Under the package notifications (\"Daily Package & Traceable Indicia Updates\"), tick Email for Expected Delivery Updates, Day of Delivery Updates, Package Delivered, Available for Pickup and Delivery Exception Updates.",
        "Save your changes.",
      ],
      senders: [
        "uspsinformeddelivery@email.informeddelivery.usps.com",
        "uspsinformeddelivery@informeddelivery.usps.com",
        "auto-reply@usps.com",
        "auto-reply@tracking.usps.com",
      ],
    },
    parserSupport: "full",
    gotchas: [
      "Some apartments and condos can't sign up, because each unit needs its own USPS delivery code and not every building has them.",
      "An eligible ZIP code doesn't mean every address in it is eligible.",
      "Only items USPS handles appear, though that includes parcels other shippers hand to USPS for the final delivery.",
      "The Daily Digest can be incomplete; USPS itself says you may have more mail or packages than it shows.",
      "No Daily Digest is sent on Sundays, federal holidays or days with no mail.",
      "Changing the name, email or address on your profile can switch the service off until you verify again, and a Change of Address suspends it.",
      "Business addresses need a USPS.com business account.",
    ],
    guideSlug: "usps-informed-delivery",
  },

  ups_my_choice: {
    id: "ups_my_choice",
    name: "UPS My Choice",
    operator: "UPS",
    carrier: "ups",
    countries: [...INTERNATIONAL],
    kind: "address",
    shows:
      "Incoming UPS packages for your address, including ones you didn't order, with alerts and an estimated delivery window.",
    cost: "Free basic membership; optional Premium (about $19.99/yr in the US) adds more delivery changes",
    signupUrl: "https://www.ups.com/us/en/track/ups-my-choice",
    dashboardUrl: "https://wwwapps.ups.com/mcdp",
    verification:
      "You create a ups.com account and confirm your email with a code. Where UPS needs more proof, it mails an activation code to the address in a welcome letter (about 7–14 days; valid for 45 days).",
    setupTime: "About 5 minutes online; some addresses need a code mailed to you (7–14 days)",
    emailAlerts: {
      howToEnable: [
        "Sign in at ups.com and open your UPS My Choice alert settings.",
        "Choose email as the way UPS contacts you.",
        "Turn on Ready for Shipment, Day Before Delivery, Day of Delivery, Delivery Date Change, Delivered and Ready for Pickup.",
        "Save your changes.",
      ],
      senders: ["mcinfo@ups.com", "pkginfo@ups.com"],
    },
    parserSupport: "full",
    gotchas: [
      "If UPS mails you an activation code, your membership isn't fully active until you enter it.",
      "The free membership is enough for alerts; Premium is optional.",
      "Only UPS packages appear, and a package may not show until UPS has its label data or first scan.",
      "UPS matches packages by name and address, so use the name your packages are addressed to.",
      "Availability and features vary by country.",
      "Genuine UPS links start with www.ups.com or billing.ups.com, which helps spot fake \"UPS\" emails.",
    ],
    guideSlug: "ups-my-choice",
  },

  fedex_delivery_manager: {
    id: "fedex_delivery_manager",
    name: "FedEx Delivery Manager",
    operator: "FedEx",
    carrier: "fedex",
    countries: [...INTERNATIONAL],
    kind: "address",
    shows:
      "FedEx Express, Ground and Home Delivery packages headed to your home, with alerts and no tracking numbers needed.",
    cost: "Free (some delivery changes cost extra)",
    signupUrl: "https://www.fedex.com/en-us/delivery-manager.html",
    dashboardUrl: null,
    verification:
      "You create a fedex.com account and FedEx checks that your name is linked to the address, usually automatically or with a code texted to your phone. Sometimes it mails a postcard with a 6-digit PIN instead.",
    setupTime: "About 5–10 minutes online; longer if FedEx mails you a postcard PIN",
    emailAlerts: {
      howToEnable: [
        "Sign in at fedex.com and choose Delivery Manager in the left-hand menu.",
        "Open your notification settings and choose email.",
        "Turn on: FedEx has a package addressed to me, the day before delivery, the day of delivery, a delivery exception has occurred, a package for me is ready to be picked up, and a delivery has been made to my address.",
        "Save your changes.",
      ],
      senders: ["trackingupdates@fedex.com", "noreply@fedex.com"],
      sendersByCountry: {
        CA: ["trackingupdates@fedex.com", "noreply@fedex.com", "fedexcanada@fedex.com"],
      },
    },
    parserSupport: "full",
    gotchas: [
      "Residential addresses only, and up to 3 addresses per account.",
      "Your name must match public records for the address; you can add other spellings of your first name.",
      "Editing an address means verifying it again.",
      "Outside the US and Canada, it only covers shipments where the sender has switched it on.",
      "FedEx says delivery preferences may not apply to every shipment.",
    ],
    guideSlug: "fedex-delivery-manager",
  },

  amazon_orders: {
    id: "amazon_orders",
    name: "Amazon order emails",
    operator: "Amazon",
    carrier: "amazon",
    countries: [...INTERNATIONAL],
    kind: "account",
    shows:
      "Shipping updates for orders placed on your own Amazon account, whichever carrier delivers them, but not packages other people send you.",
    cost: "Free with an Amazon account",
    signupUrl: "https://www.amazon.com/gp/help/customer/display.html?nodeId=GENAFPTNLHV7ZACW",
    dashboardUrl: "https://www.amazon.com/gp/css/order-history",
    verification: "Nothing extra: these are emails Amazon already sends to the address on your account.",
    setupTime: "About 2 minutes",
    emailAlerts: {
      howToEnable: [
        "Amazon emails shipping updates to the address on your Amazon account by default.",
        "If you've turned shipment emails off, turn them back on in your Amazon account's notification settings.",
        "If your household shares several Amazon accounts, set up forwarding from each account's mailbox.",
      ],
      senders: amazonSenders("amazon.com"),
      sendersByCountry: {
        CA: amazonSenders("amazon.ca"),
        GB: amazonSenders("amazon.co.uk"),
        AU: amazonSenders("amazon.com.au"),
        DE: amazonSenders("amazon.de", ["versandbestaetigung", "shipment-tracking", "order-update", "auto-confirm"]),
        NL: amazonSenders("amazon.nl", ["verzending-volgen", "update-bestelling", "auto-bevestiging", "shipment-tracking"]),
      },
    },
    parserSupport: "full",
    gotchas: [
      "Amazon emails don't include the carrier's tracking number, so these packages are tracked by order number.",
      "Orders placed on someone else's account, including gifts sent to you, won't appear.",
      "Some third-party-seller and international orders can't be tracked.",
      "Amazon parcels delivered by USPS, UPS or FedEx can also appear in those carriers' alerts.",
    ],
    guideSlug: null,
  },

  dhl_on_demand: {
    id: "dhl_on_demand",
    name: "DHL On Demand Delivery",
    operator: "DHL Express",
    carrier: "dhl",
    countries: [...INTERNATIONAL],
    kind: "per_package",
    shows:
      "Alerts for DHL Express shipments coming to you, sent one shipment at a time and matched best when the shipper has your email or mobile number.",
    cost: "Free for recipients",
    signupUrl: "https://delivery.dhl.com/",
    dashboardUrl: "https://delivery.dhl.com/shipments.xhtml",
    verification:
      "You confirm your email address and mobile number with one-time codes, then add your default address. Nothing is mailed to you.",
    setupTime: "About 5 minutes online",
    emailAlerts: {
      howToEnable: [
        "Sign up or sign in at delivery.dhl.com (pick your country first).",
        "Choose email as a notification channel in your profile.",
        "Use the same email address and mobile number you give shops, so DHL can match your shipments.",
      ],
      senders: ["noreply.odd@dhl.com", "donotreply_odd@dhl.com", "support@dhl.com"],
    },
    parserSupport: "full",
    gotchas: [
      "It covers DHL Express only. In the US, DHL eCommerce parcels are handed to USPS for delivery, so look for them in Informed Delivery.",
      "It isn't address-based: a shipment may not appear if the shipper didn't use your email or mobile number.",
    ],
    guideSlug: null,
  },

  ontrac_notifyme: {
    id: "ontrac_notifyme",
    name: "OnTrac NotifyMe",
    operator: "OnTrac (formerly LaserShip)",
    carrier: "ontrac",
    countries: ["US"],
    kind: "per_package",
    shows:
      "Text-message updates for one OnTrac package at a time once you have its tracking number; OnTrac has no account that lists packages coming to you.",
    cost: "Free",
    signupUrl: "https://www.ontrac.com/tracking/",
    dashboardUrl: null,
    verification: "None: you opt in to text alerts from a package's tracking page.",
    setupTime: "Nothing to set up in advance; opt in per package",
    emailAlerts: {
      howToEnable: [],
      senders: [],
    },
    parserSupport: "basic",
    gotchas: [
      "NotifyMe alerts are text messages, so there's nothing to forward to Package Radar.",
      "OnTrac packages only show up here if you forward an email that contains the OnTrac tracking number, such as a store's shipping confirmation.",
      "LaserShip now operates as OnTrac.",
    ],
    guideSlug: null,
  },

  canada_post_auto_tracking: {
    id: "canada_post_auto_tracking",
    name: "Canada Post automatic tracking",
    operator: "Canada Post",
    carrier: null,
    countries: ["CA"],
    kind: "address",
    shows:
      "Canada Post parcels addressed to the name and address on your profile are added to your Track list automatically, with alerts.",
    cost: "Free",
    signupUrl: "https://www.canadapost-postescanada.ca/cpc/en/personal/manage-mail/automatic-tracking.page",
    dashboardUrl: "https://www.canadapost-postescanada.ca/track-reperage/en/",
    verification:
      "You create a personal Canada Post profile and verify your identity using the name and address on your government-issued photo ID.",
    setupTime: "About 10 minutes online (have your photo ID ready)",
    emailAlerts: {
      howToEnable: [
        "Sign in to your Canada Post personal profile and turn on automatic tracking.",
        "In your notification settings, choose email for: package identified, out for delivery, ready for pickup and delivered.",
      ],
      senders: [
        "donotreply-nepasrepondre@notifications.canadapost-postescanada.ca",
        "donotreply@canadapost.postescanada.ca",
        "donotreply-nepasrepondre@communications.canadapost-postescanada.ca",
      ],
    },
    parserSupport: "basic",
    gotchas: [
      "Business and PO Box addresses aren't eligible.",
      "Canada Post's terms say not every package will be captured.",
      "Canada Post won't look up a parcel by your name or address for you.",
    ],
    guideSlug: null,
  },

  royal_mail_app: {
    id: "royal_mail_app",
    name: "Royal Mail app",
    operator: "Royal Mail",
    carrier: null,
    countries: ["GB"],
    kind: "per_package",
    shows:
      "Tracking and push alerts for Royal Mail items you add by tracking number or barcode scan; it doesn't list parcels coming to your address.",
    cost: "Free",
    signupUrl: "https://www.royalmail.com/downloadapp",
    dashboardUrl: null,
    verification: "None to track items; signing up with your email lets you set a Safeplace and delivery preferences.",
    setupTime: "About 2 minutes to install the app",
    emailAlerts: {
      howToEnable: [
        "There's no setting to turn on: Royal Mail emails you about a parcel when the sender gives Royal Mail your email address.",
      ],
      senders: ["no-reply@royalmail.com"],
    },
    parserSupport: "basic",
    gotchas: [
      "Royal Mail has no feature that shows every parcel coming to your address.",
      "Not every Royal Mail service is tracked along the way.",
    ],
    guideSlug: null,
  },

  evri_app: {
    id: "evri_app",
    name: "Evri app",
    operator: "Evri",
    carrier: null,
    countries: ["GB"],
    kind: "account",
    shows: "Evri parcels sent to the email address on your Evri account are added to your tracking list automatically.",
    cost: "Free",
    signupUrl: "https://www.evri.com/our-services/mobile-app",
    dashboardUrl: null,
    verification: "An Evri account with your email address; there's no address check.",
    setupTime: "About 5 minutes",
    emailAlerts: {
      howToEnable: [
        "Evri emails you about a parcel when the shop passes on your email address; there's nothing to switch on.",
        "Sign up in the Evri app with the email address you use for online shopping so parcels are added automatically.",
      ],
      senders: ["do-not-reply@evri.com", "donotreply@myhermes.co.uk"],
    },
    parserSupport: "basic",
    gotchas: [
      "Parcels are matched by email only, so use the same email address you give shops.",
      "Don't confuse it with the unrelated \"EVRI App\" for booking appointments.",
    ],
    guideSlug: null,
  },

  dpd_uk_app: {
    id: "dpd_uk_app",
    name: "DPD app (UK)",
    operator: "DPD UK",
    carrier: null,
    countries: ["GB"],
    kind: "account",
    shows:
      "DPD and DPD Local parcels matched to your phone number or email and your delivery address appear in the app automatically.",
    cost: "Free",
    signupUrl: "https://www.dpd.co.uk/lp/app/index.html",
    dashboardUrl: null,
    verification: "A code sent to your phone or email. A profile holds one phone number and one email address.",
    setupTime: "About 5 minutes",
    emailAlerts: {
      howToEnable: [
        "DPD emails you about a parcel when the shop passes on your email address; there's nothing to switch on.",
        "In the DPD app, add the phone number and email address you give shops, plus your delivery address.",
      ],
      senders: ["yourorder@dpd.co.uk", "yourdelivery@dpd.co.uk"],
    },
    parserSupport: "basic",
    gotchas: [
      "If you gave the shop a different phone number or email than the one in your DPD profile, the parcel won't appear.",
      "DPD's description of automatic matching is several years old, so the details may have changed.",
    ],
    guideSlug: null,
  },

  postnl_account: {
    id: "postnl_account",
    name: "PostNL account and app",
    operator: "PostNL",
    carrier: null,
    countries: ["NL"],
    kind: "address",
    shows:
      "PostNL parcels on the way to your address are linked to your account automatically when your address and first name match.",
    cost: "Free",
    signupUrl: "https://www.postnl.nl/ontvangen/postnl-account/",
    dashboardUrl: null,
    verification:
      "You confirm your address with iDIN (your bank login) or with a letter containing a code that's valid for 14 days.",
    setupTime: "About 5 minutes with iDIN; otherwise wait a few days for the letter with your code",
    emailAlerts: {
      howToEnable: [
        "PostNL emails you about a parcel when the sender shares your email address.",
        "Check the notification settings in the PostNL app or your PostNL account and make sure email updates are on.",
      ],
      senders: ["noreply@notificatie.postnl.nl", "noreply@postnl.nl", "noreply@mypostnl.nl"],
    },
    parserSupport: "basic",
    gotchas: [
      "Parcels for housemates can occasionally show up in your account too.",
      "Only PostNL parcels appear, not DHL, DPD, GLS or other couriers.",
      "Tracking a parcel on PostNL's site needs the barcode plus the recipient's postcode.",
    ],
    guideSlug: null,
  },

  dhl_paket_de: {
    id: "dhl_paket_de",
    name: "DHL Paketankündigung (Post & DHL app)",
    operator: "Deutsche Post / DHL",
    carrier: "dhl",
    countries: ["DE"],
    kind: "address",
    shows:
      "An email or app alert with the expected delivery day for DHL parcels addressed to your home, including ones you didn't order, once they reach the parcel centre.",
    cost: "Free with a DHL customer account",
    signupUrl: "https://www.dhl.de/en/privatkunden/pakete-empfangen/sendungen-verfolgen/paketankuendigung.html",
    dashboardUrl: null,
    verification:
      "You create a DHL customer account, then verify your address with an AdressTAN (a 6-digit code mailed to you, which takes a few days) or with POSTIDENT (a few minutes).",
    setupTime: "About 10 minutes online; the mailed AdressTAN takes a few days (POSTIDENT is faster)",
    emailAlerts: {
      howToEnable: [
        "Sign in to your DHL customer account at dhl.de or in the Post & DHL app.",
        "Turn on Paketankündigung (parcel announcement) and choose email.",
      ],
      senders: ["noreply@dhl.de", "no-reply@dhl.de"],
    },
    parserSupport: "basic",
    gotchas: [
      "Parcels sent to a Packstation or branch, small parcels and returns aren't announced.",
      "Only DHL parcels appear, not Hermes, DPD, GLS or Amazon's own drivers.",
    ],
    guideSlug: null,
  },

  australia_post_mypost: {
    id: "australia_post_mypost",
    name: "Australia Post MyPost",
    operator: "Australia Post",
    carrier: null,
    countries: ["AU"],
    kind: "account",
    shows:
      "Australia Post and StarTrack parcels are added to your MyPost account automatically when they match the email, mobile number or address you registered.",
    cost: "Free",
    signupUrl: "https://auspost.com.au/receiving/mypost",
    dashboardUrl: null,
    verification:
      "An email and password to create the account; verifying a mobile number unlocks SMS alerts, Parcel Lockers and Parcel Collect.",
    setupTime: "About 5 minutes",
    emailAlerts: {
      howToEnable: [
        "Sign in to MyPost and add every email address you shop with, plus your mobile number and address.",
        "Make sure email notifications are on in your MyPost settings.",
      ],
      senders: ["noreply@notifications.auspost.com.au"],
    },
    parserSupport: "basic",
    gotchas: [
      "Parcels only match if the sender has your registered email, mobile number or address, so register every email you shop with.",
      "Other couriers (Aramex, CouriersPlease, TNT and Amazon's own drivers) aren't included.",
    ],
    guideSlug: null,
  },
};

/** Every program, in display order. */
export const PROGRAMS: Program[] = Object.values(PROGRAMS_BY_ID);

/** The program with this id, or null for an unknown id. */
export function getProgram(id: string): Program | null {
  return Object.prototype.hasOwnProperty.call(PROGRAMS_BY_ID, id) ? PROGRAMS_BY_ID[id as ProgramId] : null;
}

/** Sender addresses to forward for one program, using the country-specific list when there is one. */
export function programSenders(program: Program, country?: string | null): string[] {
  const byCountry = country ? program.emailAlerts.sendersByCountry?.[country.trim().toUpperCase()] : undefined;
  return byCountry ?? program.emailAlerts.senders;
}
