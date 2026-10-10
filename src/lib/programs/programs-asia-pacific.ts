/**
 * Asia-Pacific programs beyond Australia Post MyPost (in programs.ts), from
 * research/worldwide/asia-pacific.md and its fact-check. Outside Japan,
 * Australia and New Zealand, carriers notify by app, text message or chat
 * apps rather than email; those programs are listed (they answer "what's
 * coming?") but have no email alerts we can forward, and say so.
 */
import type { Program } from "./program";

const NO_EMAIL_ALERTS: Program["emailAlerts"] = { howToEnable: [], senders: [] };

export const ASIA_PACIFIC_PROGRAMS: Program[] = [
  {
    id: "japan_post_e_delivery",
    name: "Japan Post e-Delivery Notification (Yu ID)",
    operator: "Japan Post",
    carrier: "japan_post",
    countries: ["JP"],
    kind: "address",
    shows:
      "Emails with the expected delivery date and time, and missed-delivery notices, for Japan Post parcels addressed to your name and home that the sender registered electronically.",
    cost: "Free",
    signupUrl: "https://www.post.japanpost.jp/service/receive/e-assist/notice_mail.html",
    dashboardUrl: null,
    verification:
      "A Yu ID account with your name and address; Japan Post matches parcels on both. It's unclear whether a mailed code is needed just for these emails.",
    setupTime: "About 10 minutes online",
    emailAlerts: {
      howToEnable: [
        "Sign in with your Yu ID.",
        "Press Activate under e-Delivery Notification, then confirm your email address.",
        "You can register up to 2 email addresses for the notices.",
      ],
      senders: ["info@delivery.post.japanpost.jp", "noreply@ml.post.japanpost.jp"],
    },
    parserSupport: "basic",
    gotchas: [
      "Only Yu-Pack and other items the sender registered electronically are covered.",
      "The LINE version works without a Yu ID, but LINE messages can't be forwarded to Package Radar.",
      "Parcel push notifications in the Japan Post app are only in the Japanese version of the app.",
    ],
    guideSlug: null,
  },

  {
    id: "yamato_kuroneko_members",
    name: "Yamato Kuroneko Members",
    operator: "Yamato Transport",
    carrier: "yamato",
    countries: ["JP"],
    kind: "account",
    shows:
      "Yamato emails you before delivery, after a missed delivery and when a parcel is delivered, for parcels it can match to your membership details.",
    cost: "Free",
    signupUrl: "https://cmypage.kuronekoyamato.co.jp/portal/",
    dashboardUrl: null,
    verification: "You register your name, address and phone number; Yamato checks the phone number by text message or voice call.",
    setupTime: "About 10 minutes",
    emailAlerts: NO_EMAIL_ALERTS,
    parserSupport: "basic",
    gotchas: [
      "Turn on the delivery-schedule email (お届け予定eメール) in your membership settings. We couldn't confirm the exact address Yamato sends it from (it ends in @kuronekoyamato.co.jp), so it isn't in your forwarding filter yet: forward these emails by hand, or add the sender to your filter once you've received one.",
      "The expected-delivery email only covers parcels whose sender data supports it.",
      "Yamato says its genuine emails never have attachments, and that it doesn't send missed-delivery or delivery-schedule notices by text message.",
    ],
    guideSlug: null,
  },

  {
    id: "sagawa_smart_club",
    name: "Sagawa Smart Club",
    operator: "Sagawa Express",
    carrier: "sagawa",
    countries: ["JP"],
    kind: "account",
    shows: "Sagawa emails members a delivery-schedule notice for parcels headed to them, and a notice when a parcel has been delivered.",
    cost: "Free to join, as far as we know",
    signupUrl: "https://www.sagawa-exp.co.jp/",
    dashboardUrl: null,
    verification: "A Smart Club membership; some services need an identity check. Sagawa doesn't publish exactly how it matches parcels to members.",
    setupTime: "About 10 minutes",
    emailAlerts: {
      howToEnable: ["Sign in to Smart Club and make sure delivery-schedule emails (配達予定通知メール) are turned on."],
      senders: ["info-nimotsu@sagawa-exp.co.jp"],
    },
    parserSupport: "basic",
    gotchas: [
      "In 2026 Sagawa suspended parts of its web services after a reported security incident, so some features may not work; check Sagawa's own notices before you sign up.",
      "Sagawa says it never sends collection or delivery notices by text message.",
    ],
    guideSlug: null,
  },

  {
    id: "cj_logistics_one",
    name: "CJ Logistics O-NE app",
    operator: "CJ Logistics",
    carrier: "cj_logistics",
    countries: ["KR"],
    kind: "account",
    shows:
      "After you verify your phone number, the app lists every CJ Logistics parcel from the last 90 days whose recipient phone number matches yours.",
    cost: "Free",
    signupUrl: "https://www.cjlogistics.com/",
    dashboardUrl: null,
    verification: "Phone identity verification (본인인증).",
    setupTime: "About 5 minutes",
    emailAlerts: NO_EMAIL_ALERTS,
    parserSupport: "basic",
    gotchas: [
      "Alerts come in the app or KakaoTalk, not by email, so Package Radar can't show these parcels unless you also get an email about them.",
      "Parcels don't appear if the sender typed a different phone number, and can take up to about 4 hours to show up.",
    ],
    guideSlug: null,
  },

  {
    id: "cainiao_app",
    name: "Cainiao app",
    operator: "Cainiao",
    carrier: "cainiao",
    countries: ["CN"],
    kind: "account",
    shows: "Bind your phone number and shopping accounts (Taobao, Tmall and others) and parcels coming to you are listed automatically.",
    cost: "Free",
    signupUrl: "https://www.cainiao.com/",
    dashboardUrl: null,
    verification: "Your phone number, confirmed with a text-message code.",
    setupTime: "About 5 minutes",
    emailAlerts: NO_EMAIL_ALERTS,
    parserSupport: "basic",
    gotchas: [
      "Alerts come by app, text message or WeChat, not email, so Package Radar can't show these parcels unless you also get an email about them.",
      "Not every carrier is covered, and parcels sent with a privacy waybill (a virtual phone number) may not match.",
      "It may need a mainland China phone number.",
    ],
    guideSlug: null,
  },

  {
    id: "nz_post_app",
    name: "NZ Post app (My NZ Post)",
    operator: "NZ Post",
    carrier: "nz_post",
    countries: ["NZ"],
    kind: "account",
    shows: "Sign in with your My NZ Post account and NZ Post links eligible parcels to it automatically, showing who sent them.",
    cost: "Free",
    signupUrl: "https://nzpost.co.nz/personal/app",
    dashboardUrl: null,
    verification: "A My NZ Post account; NZ Post doesn't say whether it matches parcels by email address or phone number.",
    setupTime: "About 5 minutes",
    emailAlerts: NO_EMAIL_ALERTS,
    parserSupport: "basic",
    gotchas: [
      "NZ Post only emails you about a parcel if the sender gave it your email address. Its emails always come from addresses ending in @nzpost.co.nz, but we couldn't confirm the exact one, so they aren't in your forwarding filter yet.",
      "With Collect my parcel, NZ Post emails the address on your account when a parcel is ready; you have 10 days to collect it.",
    ],
    guideSlug: null,
  },

  {
    id: "aramex_receiving_mode",
    name: "Aramex Receiving mode (aramexConnect)",
    operator: "Aramex",
    carrier: "aramex",
    countries: ["AU", "NZ"],
    kind: "account",
    shows: "Aramex parcels whose label has the email address you signed up with appear in one place, with photo proof of delivery.",
    cost: "Free",
    signupUrl: "https://www.aramex.com.au/tools/aramexconnect/receiving-mode/",
    signupUrlByCountry: { NZ: "https://www.aramex.co.nz/tools/aramexconnect/receiving-mode/" },
    dashboardUrl: null,
    verification:
      "You sign up with an email address and password (or Google or Facebook), confirm your email, then add your name, address and contact details.",
    setupTime: "About 5 minutes in a web browser",
    emailAlerts: NO_EMAIL_ALERTS,
    parserSupport: "basic",
    gotchas: [
      "You must sign up with the same email address the sender put on your shipping label.",
      "We couldn't confirm which address Aramex's emails come from, so Package Radar can't add them to your forwarding filter yet. Forward them by hand if you get any.",
    ],
    guideSlug: null,
  },
];
