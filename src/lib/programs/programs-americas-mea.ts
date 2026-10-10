/**
 * Programs in the Americas (beyond the US and Canada Post, in programs.ts),
 * the Middle East and Africa, from research/worldwide/americas-mea.md and its
 * fact-check. Outside Canada, the programs we found notify in an app or by
 * text message, and no email channel is confirmed; they're listed with that
 * caveat rather than left out.
 */
import type { Program } from "./program";

const NO_EMAIL_ALERTS: Program["emailAlerts"] = { howToEnable: [], senders: [] };

export const AMERICAS_MEA_PROGRAMS: Program[] = [
  {
    id: "purolator_emails",
    name: "Purolator shipment emails",
    operator: "Purolator",
    carrier: "purolator",
    countries: ["CA"],
    kind: "per_package",
    shows:
      "Emails about one Purolator shipment at a time, sent only when the shipper sets them up with your email address; Purolator has no sign-up for recipients.",
    cost: "Free",
    signupUrl: "https://www.purolator.com/",
    dashboardUrl: null,
    verification: "None: the shipper adds your email address to the shipment.",
    setupTime: "Nothing to set up",
    emailAlerts: {
      howToEnable: ["There's no setting to turn on: Purolator emails you when the shipper adds your email address to the shipment."],
      senders: ["notificationservice@purolator.com"],
    },
    parserSupport: "basic",
    gotchas: [
      "Purolator Your Way delivery options only work through links in text messages sent to the phone number the shipper gave.",
    ],
    guideSlug: null,
  },

  {
    id: "intelcom_emails",
    name: "Intelcom (Dragonfly) delivery emails",
    operator: "Intelcom / Dragonfly",
    carrier: null,
    countries: ["CA"],
    kind: "per_package",
    shows:
      "Emails about one Intelcom or Dragonfly delivery at a time, including a heads-up when it's a few hours away, if email notifications are on for that delivery.",
    cost: "Free",
    signupUrl: "https://intelcom.ca/en/faq/",
    dashboardUrl: null,
    verification: "None: Intelcom emails you when the shop passes on your email address.",
    setupTime: "Nothing to set up",
    emailAlerts: {
      howToEnable: ["There's no setting to turn on: Intelcom emails you about a delivery when the shop passes on your email address."],
      senders: [
        "notifications@intelcom.ca",
        "notifications@dragonflyshipping.ca",
        "notifications@dragonflyshipping.com",
        "notifications@ca.dragonflyinternational.com",
      ],
    },
    parserSupport: "basic",
    gotchas: ["Intelcom has no recipient account, so there's no list of everything coming to you."],
    guideSlug: null,
  },

  {
    id: "correios_meu_correios",
    name: "Correios: Meu Correios and the Correios app",
    operator: "Correios",
    carrier: "correios",
    countries: ["BR"],
    kind: "account",
    shows: "Once you sign in, Correios lists the items linked to your CPF, split into in transit and delivered.",
    cost: "Free",
    signupUrl: "https://www.correios.com.br/atendimento/ferramentas/meu-correios-1",
    dashboardUrl: null,
    verification: "A Correios account; your CPF is checked against Receita Federal records.",
    setupTime: "About 10 minutes",
    emailAlerts: NO_EMAIL_ALERTS,
    parserSupport: "basic",
    gotchas: [
      "Items only appear if your CPF was recorded when they were posted, so many shop parcels won't show.",
      "For imports, you may need to add your CPF yourself under Minhas Importações.",
      "Correios alerts come as app notifications; we couldn't confirm email alerts, so Package Radar may not see these items.",
      "Correios says it only sends email from @correios.com.br addresses.",
    ],
    guideSlug: null,
  },

  {
    id: "israel_post_my_post",
    name: "Israel Post My Post",
    operator: "Israel Post",
    carrier: "israel_post",
    countries: ["IL"],
    kind: "account",
    shows:
      "Parcels sent to the mobile numbers you register, from Israel and abroad, appear in the app with the item number and the name of the site that sent them.",
    cost: "Free to register",
    signupUrl: "https://israelpost.co.il/pages/my_post",
    dashboardUrl: "https://mypost.israelpost.co.il/",
    verification:
      "Your mobile number, confirmed with a one-time text-message code; you can sign in with your ID number or email and a password, Google or Apple.",
    setupTime: "About 5 minutes",
    emailAlerts: NO_EMAIL_ALERTS,
    parserSupport: "basic",
    gotchas: [
      "Register the same phone numbers you give online shops.",
      "We couldn't confirm whether My Post sends email alerts, so Package Radar may not see these parcels.",
      "israelpost.co.il is Israel Post's real website; scammers use look-alike addresses.",
    ],
    guideSlug: null,
  },

  {
    id: "spl_tawakkalna",
    name: "Saudi Post (SPL) in the Tawakkalna app",
    operator: "Saudi Post (SPL)",
    carrier: null,
    countries: ["SA"],
    kind: "account",
    shows:
      "After you sign in with your national identity, SPL's services in Tawakkalna let you see and track incoming, outgoing and completed shipments, and manage your National Address.",
    cost: "Free",
    signupUrl: "https://splonline.com.sa/en/media-center/news/20250320/",
    dashboardUrl: null,
    verification: "Your national identity login in the Tawakkalna app.",
    setupTime: "About 5 minutes if you already use Tawakkalna",
    emailAlerts: NO_EMAIL_ALERTS,
    parserSupport: "basic",
    gotchas: [
      "We couldn't confirm how SPL links incoming shipments to you or whether it sends email, so Package Radar may not see these shipments.",
      "A National Address is reported to be required on parcels in Saudi Arabia from January 2026, so give shops yours.",
    ],
    guideSlug: null,
  },

  {
    id: "emirates_post_app",
    name: "Emirates Post app",
    operator: "Emirates Post",
    carrier: "emirates_post",
    countries: ["AE"],
    kind: "account",
    shows: "Registered users see a timeline of their incoming and outgoing shipments in the app.",
    cost: "Free",
    signupUrl: "https://www.emiratespost.ae/all-services/mobile-app",
    dashboardUrl: null,
    verification: "Your Emirates ID number, mobile number and email address.",
    setupTime: "About 5 minutes",
    emailAlerts: NO_EMAIL_ALERTS,
    parserSupport: "basic",
    gotchas: [
      "We couldn't confirm whether parcels you haven't tracked appear automatically, or whether the app sends email, so Package Radar may not see them.",
      "Emirates Post says it never asks for card details by text message, WhatsApp or email.",
    ],
    guideSlug: null,
  },

  {
    id: "aramex_emails",
    name: "Aramex delivery emails",
    operator: "Aramex",
    carrier: "aramex",
    countries: ["AE", "SA"],
    kind: "per_package",
    shows:
      "Emails about one Aramex shipment at a time when the shop gives Aramex your email address; here Aramex has no account that lists everything coming to you.",
    cost: "Free",
    signupUrl: "https://www.aramex.com/",
    dashboardUrl: null,
    verification: "None: Aramex emails you when the shop passes on your email address.",
    setupTime: "Nothing to set up",
    emailAlerts: {
      howToEnable: ["There's no setting to turn on: Aramex emails you about a shipment when the shop passes on your email address."],
      senders: ["epod@aramex.com"],
    },
    parserSupport: "basic",
    gotchas: [
      "Aramex's Receiving mode, which lists parcels sent to your email address, is only offered in Australia and New Zealand.",
      "We've only confirmed the address Aramex's delivery confirmations come from, so some other Aramex emails may not be forwarded automatically.",
    ],
    guideSlug: null,
  },

  {
    id: "noon_orders",
    name: "noon order emails",
    operator: "noon",
    carrier: null,
    countries: ["AE", "SA", "EG"],
    kind: "account",
    shows: "Shipping updates for orders on your own noon account, but not parcels other people send you.",
    cost: "Free with a noon account",
    signupUrl: "https://www.noon.com/",
    dashboardUrl: null,
    verification: "Nothing extra: these are emails noon already sends to the address on your account.",
    setupTime: "About 2 minutes",
    emailAlerts: {
      howToEnable: ["noon emails order updates to the address on your noon account; there's nothing to switch on."],
      senders: ["orders@noon.com"],
    },
    parserSupport: "basic",
    gotchas: [
      "Orders placed on someone else's noon account won't appear.",
      "noon's marketing emails come from other addresses and aren't forwarded.",
    ],
    guideSlug: null,
  },

  {
    id: "posta_kenya_mpost",
    name: "Posta Kenya MPost",
    operator: "Posta Kenya",
    carrier: null,
    countries: ["KE"],
    kind: "account",
    shows: "A virtual PO Box tied to your mobile number sends you a text message when a letter or parcel for it reaches the post office you chose.",
    cost: "Paid: about KSh 2,000 a year for individuals (2024 price)",
    signupUrl: "https://mpost.co.ke/",
    dashboardUrl: null,
    verification: "Registration with your mobile number.",
    setupTime: "About 10 minutes",
    emailAlerts: NO_EMAIL_ALERTS,
    parserSupport: "basic",
    gotchas: [
      "Alerts come by text message, not email, so Package Radar can't show these items.",
      "You have 7 days to collect an item; delivery to your door costs extra.",
    ],
    guideSlug: null,
  },
];
