/**
 * Step-by-step copy for auto-forwarding carrier emails to a user's inbound
 * address, per email provider. Flows and labels follow research/forwarding.md:
 * Gmail needs the forwarding address confirmed before a filter can use it;
 * Outlook rules and iCloud rules need no confirmation; Yahoo can only forward
 * everything, and only on paid plans.
 */
import type { ProgramId } from "@/lib/types";
import { getProgram, programSenders } from "./programs";

export type EmailProvider = "gmail" | "outlook" | "yahoo" | "icloud" | "other";

export interface FilterInstructions {
  provider: EmailProvider;
  /** e.g. "Gmail", "Outlook.com, Hotmail or Microsoft 365". */
  label: string;
  steps: string[];
  /** Gmail search query for the filter (`from:(a OR b)`); null for providers that don't use one. */
  filterQuery: string | null;
  /** Deduplicated lowercase sender addresses the filter / rule should match. */
  senders: string[];
  /** True when the provider emails a confirmation to the inbound address first (Gmail, Yahoo). */
  needsForwardingVerification: boolean;
  verificationNote: string | null;
  caveats: string[];
  /** Deep links into the provider's settings, in the order the steps use them. */
  links: { label: string; url: string }[];
}

export interface FilterOptions {
  /** ISO country of the account; picks regional senders such as amazon.co.uk. */
  country?: string | null;
  /** Extra sender addresses or domains to include, e.g. a forwarding self-test sender. Invalid entries are ignored. */
  extraSenders?: string[];
}

/** Providers in the order a picker should show them. */
export const EMAIL_PROVIDERS: { id: EmailProvider; label: string }[] = [
  { id: "gmail", label: "Gmail" },
  { id: "outlook", label: "Outlook.com, Hotmail or Microsoft 365" },
  { id: "yahoo", label: "Yahoo Mail" },
  { id: "icloud", label: "iCloud Mail" },
  { id: "other", label: "Another email provider" },
];

const PROVIDER_IDS: ReadonlySet<string> = new Set(EMAIL_PROVIDERS.map((p) => p.id));

/** Gmail rejects filters whose criteria are much longer than this (about 1,470–1,500 characters observed). */
const GMAIL_FILTER_SOFT_LIMIT = 1400;

const SENDER_RE = /^(?:[a-z0-9._%+-]+@)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/**
 * Sender addresses to forward for the chosen programs: deduplicated, lowercase,
 * in program order. Programs with no email alerts (OnTrac) contribute nothing.
 */
export function collectSenders(programIds: readonly ProgramId[], options: FilterOptions = {}): string[] {
  const seen = new Set<string>();
  const add = (sender: string) => {
    const s = sender.trim().toLowerCase();
    if (SENDER_RE.test(s)) seen.add(s);
  };
  for (const id of Array.isArray(programIds) ? programIds : []) {
    const program = getProgram(id);
    if (program) programSenders(program, options.country).forEach(add);
  }
  for (const extra of options.extraSenders ?? []) if (typeof extra === "string") add(extra);
  return [...seen];
}

/** Best guess at the provider from an email address's domain; custom domains return "other". */
export function guessEmailProvider(email: string): EmailProvider {
  const domain = (typeof email === "string" ? email : "").trim().toLowerCase().split("@").pop() ?? "";
  if (domain === "gmail.com" || domain === "googlemail.com") return "gmail";
  if (/^(?:outlook|hotmail|live|msn)\.[a-z.]+$/.test(domain)) return "outlook";
  if (/^(?:yahoo\.[a-z.]+|ymail\.com|rocketmail\.com)$/.test(domain)) return "yahoo";
  if (domain === "icloud.com" || domain === "me.com" || domain === "mac.com") return "icloud";
  return "other";
}

const NO_SENDERS_STEP =
  "None of the programs you picked send email alerts, so there's nothing to forward yet. Pick at least one program with email alerts (for example USPS Informed Delivery).";

function gmail(inbound: string, senders: string[]): Omit<FilterInstructions, "provider" | "label" | "senders"> {
  const fromValue = senders.join(" OR ");
  const filterQuery = senders.length ? `from:(${fromValue})` : null;
  const caveats = [
    "Do this on a computer: the Gmail phone app can't change forwarding or filters.",
    "Work or school Google accounts: if you don't see \"Add a forwarding address\", your administrator has turned off automatic forwarding.",
    "Filters only forward new emails, not ones already in your inbox.",
    "The links open your first signed-in Google account (u/0). If you use several, switch to the right one first.",
  ];
  if (filterQuery && filterQuery.length > GMAIL_FILTER_SOFT_LIMIT) {
    caveats.push("This filter is long; if Gmail says it's too long, split the senders across two filters.");
  }
  const links = [{ label: "Open Gmail forwarding settings", url: "https://mail.google.com/mail/u/0/#settings/fwdandpop" }];
  if (senders.length) {
    links.push(
      {
        label: "Create the delivery filter (pre-filled)",
        url: `https://mail.google.com/mail/u/0/#create-filter/from=${encodeURIComponent(fromValue)}`,
      },
      { label: "Open Gmail filters", url: "https://mail.google.com/mail/u/0/#settings/filters" },
    );
  }
  return {
    steps: [
      "On a computer, open Gmail, click the gear icon, then See all settings → Forwarding and POP/IMAP.",
      `Click Add a forwarding address, enter ${inbound}, then click Next → Proceed → OK. Gmail may ask you to sign in again.`,
      `Gmail emails a confirmation to ${inbound}. Within a minute or two it appears on your Package Radar setup page: open the confirmation link there and click Confirm on Google's page (if Gmail shows a code box instead, enter the code we show).`,
      "Back in Gmail, leave \"Disable forwarding\" selected. We only want delivery emails, not all your mail.",
      ...(senders.length
        ? [
            `Open the Filters and Blocked Addresses tab and click Create a new filter. In the From box, paste: ${fromValue}`,
            `Click Create filter, tick "Forward it to" and choose ${inbound}. Also tick "Never send it to Spam". Click Create filter.`,
            "For about a week Gmail shows a notice that your filters are forwarding some of your email. That's expected.",
          ]
        : [NO_SENDERS_STEP]),
    ],
    filterQuery,
    needsForwardingVerification: true,
    verificationNote: `Gmail sends a confirmation email to ${inbound} before it lets you forward there. Package Radar shows the confirmation link (and a code, if Gmail includes one) on your setup page. You must confirm it before the address appears under "Forward it to".`,
    caveats,
    links,
  };
}

function outlook(inbound: string, senders: string[]): Omit<FilterInstructions, "provider" | "label" | "senders"> {
  return {
    steps: senders.length
      ? [
          "Open Outlook on the web, then Settings → Mail → Rules (use the links below for a personal or a work/school account).",
          "Click + Add new rule and name it \"Package Radar\".",
          `Add a condition: choose From (it may be labelled "Sender address includes") and add each of these addresses: ${senders.join(", ")}.`,
          `Add an action: choose Redirect to and enter ${inbound}. If Redirect to isn't listed, choose Forward to instead.`,
          "Click Save. Outlook doesn't send a confirmation email, so forwarding starts right away.",
        ]
      : [NO_SENDERS_STEP],
    filterQuery: null,
    needsForwardingVerification: false,
    verificationNote: null,
    caveats: [
      "Microsoft 365 work or school accounts often block forwarding to outside addresses. If you get an \"Undeliverable … 5.7.520\" message, ask your IT team, or use a personal address for your carrier accounts.",
      "Redirect keeps the original sender, which helps us recognize carrier emails; Forward to works too.",
      "Menu labels differ a little between Outlook versions.",
    ],
    links: [
      { label: "Outlook rules (personal account)", url: "https://outlook.live.com/mail/0/options/mail/rules" },
      { label: "Outlook rules (work or school account)", url: "https://outlook.office.com/mail/options/mail/rules" },
    ],
  };
}

function yahoo(inbound: string): Omit<FilterInstructions, "provider" | "label" | "senders"> {
  return {
    steps: [
      "Automatic forwarding needs a paid Yahoo Mail Plus plan; free Yahoo accounts can't auto-forward.",
      "In Yahoo Mail, open Settings (gear icon) → More Settings → Mailboxes, then select your Yahoo address.",
      `Under Forwarding, enter ${inbound} and click Verify.`,
      `Yahoo emails a verification link to ${inbound}. It appears on your Package Radar setup page within a few minutes: open it to approve forwarding.`,
    ],
    filterQuery: null,
    needsForwardingVerification: true,
    verificationNote: `Yahoo sends a verification link to ${inbound} before it starts forwarding. Package Radar shows it on your setup page.`,
    caveats: [
      "Yahoo can't forward only some emails: it forwards everything. Package Radar never stores email contents; it keeps only the shipment details it finds (carrier, tracking number, status and dates) and discards the rest.",
      "With a free Yahoo account, forward carrier emails by hand, or use a Gmail or Outlook.com address for your carrier accounts instead.",
    ],
    links: [],
  };
}

function icloud(inbound: string, senders: string[]): Omit<FilterInstructions, "provider" | "label" | "senders"> {
  return {
    steps: senders.length
      ? [
          "Go to icloud.com/mail on a computer or in a phone's web browser.",
          "Open the settings menu at the top of the mailbox list, choose Settings → Rules, then Add a Rule.",
          `Set the condition to "is from" and enter the first address below. Set the action to "Forward to" and enter ${inbound}. Click Done.`,
          `Repeat for each address (one rule per address, ${senders.length} in total): ${senders.join(", ")}.`,
          "New rules can take up to 15 minutes to start working.",
        ]
      : [NO_SENDERS_STEP],
    filterQuery: null,
    needsForwardingVerification: false,
    verificationNote:
      "iCloud isn't known to ask for confirmation, but if it does, its confirmation email will appear on your Package Radar setup page.",
    caveats: [
      "Set the rules up on iCloud.com rather than in the Mail app on a Mac, so forwarding doesn't depend on that computer being switched on.",
    ],
    links: [{ label: "Open iCloud Mail", url: "https://www.icloud.com/mail" }],
  };
}

function other(inbound: string, senders: string[]): Omit<FilterInstructions, "provider" | "label" | "senders"> {
  return {
    steps: senders.length
      ? [
          "Open your email settings and look for Rules, Filters or Forwarding.",
          `Create a rule for messages from any of these senders: ${senders.join(", ")}.`,
          `Set the rule's action to redirect or forward the message to ${inbound}. Choose "redirect" if it's offered, because it keeps the original sender.`,
          `If your provider emails a confirmation to ${inbound}, it will appear on your Package Radar setup page; open it to approve forwarding.`,
          "Save the rule.",
        ]
      : [NO_SENDERS_STEP],
    filterQuery: null,
    needsForwardingVerification: false,
    verificationNote:
      "Some providers send a confirmation email to the forwarding address first. If yours does, it will appear on your Package Radar setup page.",
    caveats: [
      "Work or school accounts often block forwarding to outside addresses.",
      "If your provider can only forward all of your mail, Package Radar keeps only the shipment details it finds and never stores email contents.",
    ],
    links: [],
  };
}

/**
 * Setup copy for forwarding the chosen programs' carrier emails from
 * `provider` to `inboundAddress`. `options.country` picks regional senders
 * (amazon.co.uk etc.); `options.extraSenders` adds e.g. a self-test sender.
 */
export function buildFilterInstructions(
  provider: EmailProvider,
  inboundAddress: string,
  programIds: ProgramId[],
  options: FilterOptions = {},
): FilterInstructions {
  const id: EmailProvider = PROVIDER_IDS.has(provider) ? provider : "other";
  const label = EMAIL_PROVIDERS.find((p) => p.id === id)?.label ?? "Another email provider";
  const inbound = (typeof inboundAddress === "string" ? inboundAddress.trim() : "") || "your Package Radar address";
  const senders = collectSenders(programIds, options);
  const body =
    id === "gmail"
      ? gmail(inbound, senders)
      : id === "outlook"
        ? outlook(inbound, senders)
        : id === "yahoo"
          ? yahoo(inbound)
          : id === "icloud"
            ? icloud(inbound, senders)
            : other(inbound, senders);
  return { provider: id, label, senders, ...body };
}
