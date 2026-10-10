/**
 * Step-by-step copy for auto-forwarding carrier emails to a user's inbound
 * address, per email provider. Flows and labels follow research/forwarding.md:
 * Gmail needs the forwarding address confirmed before a filter can use it;
 * Outlook rules and iCloud rules need no confirmation; Yahoo can only forward
 * everything, and only on paid plans.
 *
 * Regional mailboxes (GMX / WEB.DE, Seznam, Mail.ru, Yandex, QQ, NetEase,
 * Naver, Daum) come from research/worldwide/global-compliance.md §3: their
 * domains are from Mozilla's Thunderbird ISPDB, but their forwarding menus
 * could not be checked with real accounts, so the steps name the settings
 * area the research points to and say plainly that labels may differ.
 * Mailboxes the research found no filter-based forwarding for (Orange,
 * Libero, Yahoo! JAPAN, t-online…) use the generic "other" steps, which
 * explain the fallbacks.
 */
import type { ProgramId } from "@/lib/types";
import { normalizeCountryCode } from "@/lib/location/countries";
import { getProgram, programSenders } from "./programs";

export type EmailProvider =
  | "gmail"
  | "outlook"
  | "yahoo"
  | "icloud"
  | "gmx" // GMX and WEB.DE (same company and webmail platform)
  | "seznam"
  | "mailru"
  | "yandex"
  | "qq"
  | "netease" // 163.com and 126.com
  | "naver"
  | "daum" // Daum / Kakao (daum.net, hanmail.net)
  | "other";

export interface FilterInstructions {
  provider: EmailProvider;
  /** e.g. "Gmail", "Outlook.com, Hotmail or Microsoft 365". */
  label: string;
  steps: string[];
  /** Gmail search query for the filter (`from:(a OR b)`); null for providers that don't use one. */
  filterQuery: string | null;
  /** Deduplicated lowercase sender addresses the filter / rule should match. */
  senders: string[];
  /** True when the provider emails a confirmation to the inbound address first (Gmail, Yahoo; probably Mail.ru and Yandex). */
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

export interface EmailProviderInfo {
  id: EmailProvider;
  /** Full name for headings, e.g. "Outlook.com, Hotmail or Microsoft 365". */
  label: string;
  /** Short name for tabs and buttons, e.g. "Outlook". */
  shortLabel: string;
  /** Mailbox domains guessEmailProvider() recognizes (Outlook and Yahoo also match by pattern). */
  domains: readonly string[];
  /** Countries where it is a common mailbox, so suggestedEmailProviders() lists it first there. Empty for global providers. */
  countries: readonly string[];
}

/** Every provider, global ones first, then regional ones, then "other". */
export const EMAIL_PROVIDERS: EmailProviderInfo[] = [
  { id: "gmail", label: "Gmail", shortLabel: "Gmail", domains: ["gmail.com", "googlemail.com"], countries: [] },
  {
    id: "outlook",
    label: "Outlook.com, Hotmail or Microsoft 365",
    shortLabel: "Outlook",
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
    countries: [],
  },
  {
    id: "yahoo",
    label: "Yahoo Mail",
    shortLabel: "Yahoo",
    domains: ["yahoo.com", "ymail.com", "rocketmail.com", "myyahoo.com", "cox.net"],
    countries: [],
  },
  { id: "icloud", label: "iCloud Mail", shortLabel: "iCloud", domains: ["icloud.com", "me.com", "mac.com"], countries: [] },
  {
    id: "gmx",
    label: "GMX or WEB.DE",
    shortLabel: "GMX / WEB.DE",
    domains: [
      "gmx.net", "gmx.de", "gmx.at", "gmx.ch", "gmx.eu", "gmx.biz", "gmx.org", "gmx.info", "web.de",
      "gmx.com", "gmx.us", "gmx.co.uk", "gmx.fr", "gmx.es", "gmx.it", "gmx.ca", "gmx.com.br", "gmx.com.tr", "gmx.tm", "gmx.li",
    ],
    countries: ["DE", "AT", "CH"],
  },
  {
    id: "seznam",
    label: "Seznam.cz Email",
    shortLabel: "Seznam",
    domains: ["seznam.cz", "email.cz", "post.cz", "spoluzaci.cz"],
    countries: ["CZ"],
  },
  { id: "mailru", label: "Mail.ru", shortLabel: "Mail.ru", domains: ["mail.ru", "inbox.ru", "list.ru", "bk.ru"], countries: ["RU", "BY", "KZ"] },
  {
    id: "yandex",
    label: "Yandex Mail",
    shortLabel: "Yandex",
    domains: ["yandex.ru", "yandex.com", "yandex.net", "yandex.by", "yandex.kz", "yandex.ua", "ya.ru", "narod.ru"],
    countries: ["RU", "BY", "KZ"],
  },
  { id: "qq", label: "QQ Mail", shortLabel: "QQ", domains: ["qq.com"], countries: ["CN"] },
  { id: "netease", label: "NetEase Mail (163.com or 126.com)", shortLabel: "163 / 126", domains: ["163.com", "126.com"], countries: ["CN"] },
  { id: "naver", label: "Naver Mail", shortLabel: "Naver", domains: ["naver.com"], countries: ["KR"] },
  { id: "daum", label: "Daum Mail (Kakao)", shortLabel: "Daum", domains: ["daum.net", "hanmail.net"], countries: ["KR"] },
  { id: "other", label: "Another email provider", shortLabel: "Other", domains: [], countries: [] },
];

const PROVIDERS_BY_ID: ReadonlyMap<string, EmailProviderInfo> = new Map(EMAIL_PROVIDERS.map((p) => [p.id, p]));

const PROVIDER_BY_DOMAIN: ReadonlyMap<string, EmailProvider> = new Map(
  EMAIL_PROVIDERS.flatMap((p) => p.domains.map((domain) => [domain, p.id] as const)),
);

/** Providers offered everywhere, in picker order. */
const GLOBAL_PROVIDERS: readonly EmailProvider[] = EMAIL_PROVIDERS.filter(
  (p) => p.countries.length === 0 && p.id !== "other",
).map((p) => p.id);

/** True for a provider id we have instructions for (e.g. a value read back from browser storage). */
export function isEmailProvider(value: unknown): value is EmailProvider {
  return typeof value === "string" && PROVIDERS_BY_ID.has(value);
}

/**
 * The providers to offer for an account in `country`, most likely first:
 * that country's common regional mailboxes (DE → GMX / WEB.DE, CZ → Seznam,
 * KR → Naver and Daum…), then Gmail, Outlook, Yahoo and iCloud, then "other".
 * Regional mailboxes of other countries are left out to keep the picker short.
 */
export function suggestedEmailProviders(country?: string | null): EmailProvider[] {
  const code = normalizeCountryCode(country ?? null);
  const regional = code
    ? EMAIL_PROVIDERS.filter((p) => p.countries.includes(code)).map((p) => p.id)
    : [];
  return [...regional, ...GLOBAL_PROVIDERS, "other"];
}

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

/**
 * Best guess at the provider from an email address's domain. Custom domains,
 * and mailboxes we have no specific steps for (Orange, Libero, Yahoo! JAPAN,
 * which is a separate company from Yahoo…), return "other".
 */
export function guessEmailProvider(email: string): EmailProvider {
  const domain = (typeof email === "string" ? email : "").trim().toLowerCase().split("@").pop() ?? "";
  const known = PROVIDER_BY_DOMAIN.get(domain);
  if (known) return known;
  if (/^(?:outlook|hotmail|live|msn)\.[a-z.]+$/.test(domain)) return "outlook";
  // Yahoo! JAPAN (yahoo.co.jp) is run by LY Corporation, not Yahoo, and works differently.
  if (/^yahoo\.[a-z.]+$/.test(domain) && domain !== "yahoo.co.jp") return "yahoo";
  return "other";
}

const NO_SENDERS_STEP =
  "None of the programs you picked send email alerts, so there's nothing to forward yet. Pick at least one program with email alerts (for example USPS Informed Delivery).";

/** For mailboxes that can't forward only some messages: the fallbacks from global-compliance.md §3. */
const PARTIAL_FORWARDING_FALLBACK =
  "Some providers can't automatically forward only some messages (they forward everything, or only on a paid plan). If yours can't, forward carrier emails by hand, set up the rule in a mail app such as Thunderbird or Apple Mail instead (it only runs while that app is open), or use a separate free Gmail or Outlook.com address just for your carrier notifications and forward everything from it.";

type ProviderBody = Omit<FilterInstructions, "provider" | "label" | "senders">;

function gmail(inbound: string, senders: string[]): ProviderBody {
  const fromValue = senders.join(" OR ");
  const filterQuery = senders.length ? `from:(${fromValue})` : null;
  const caveats = [
    "Do this on a computer: the Gmail phone app can't change forwarding or filters.",
    "Work or school Google accounts: if you don't see \"Add a forwarding address\", your administrator has turned off automatic forwarding.",
    "Filters only forward new emails, not ones already in your inbox.",
    "The links open your first signed-in Google account (u/0). If you use several, switch to the right one first.",
    "If Gmail is set to another language, its menu names are translated; the links below open the right settings pages.",
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

function outlook(inbound: string, senders: string[]): ProviderBody {
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
      "Menu labels differ a little between Outlook versions and languages.",
    ],
    links: [
      { label: "Outlook rules (personal account)", url: "https://outlook.live.com/mail/0/options/mail/rules" },
      { label: "Outlook rules (work or school account)", url: "https://outlook.office.com/mail/options/mail/rules" },
    ],
  };
}

function yahoo(inbound: string): ProviderBody {
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
      "Yahoo! JAPAN Mail (addresses ending in yahoo.co.jp) is a separate service: choose \"Another email provider\" for it.",
    ],
    links: [],
  };
}

function icloud(inbound: string, senders: string[]): ProviderBody {
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

/** What we know about a regional mailbox's forwarding, all unconfirmed with a real account. */
interface RegionalMailbox {
  /** Name used in sentences, e.g. "GMX or WEB.DE". */
  name: string;
  /** Where the rule lives, with the provider's own label in brackets. */
  settings: string;
  /** The forwarding action, with the provider's own label in brackets. */
  action: string;
  /** "likely": the research believes it emails a confirmation to the destination first. */
  confirmation: "likely" | "maybe";
  /** Provider-specific caveats, shown before the general ones. */
  notes: string[];
  links: { label: string; url: string }[];
}

const CHINA_NOTE =
  "Carriers in mainland China mostly send updates by text message, WeChat or their apps rather than email, so there may be few emails to forward.";
const KOREA_NOTE =
  "Korean carriers mostly send updates by KakaoTalk or text message rather than email, so there may be few emails to forward.";

const REGIONAL: Readonly<Partial<Record<EmailProvider, RegionalMailbox>>> = {
  gmx: {
    name: "GMX or WEB.DE",
    settings: "Settings (Einstellungen) → Filter rules (Filterregeln)",
    action: "Forward to (Weiterleiten an)",
    confirmation: "maybe",
    notes: [
      "If you'd rather use a rule in a mail app such as Thunderbird, GMX and WEB.DE first need POP3/IMAP access switched on in their settings.",
    ],
    links: [
      { label: "Open GMX", url: "https://www.gmx.net/" },
      { label: "Open WEB.DE", url: "https://web.de/" },
      { label: "GMX help: switch on POP3/IMAP (for mail apps)", url: "https://hilfe.gmx.net/pop-imap/einschalten.html" },
      { label: "WEB.DE help: switch on POP3/IMAP (for mail apps)", url: "https://hilfe.web.de/pop-imap/einschalten.html" },
    ],
  },
  seznam: {
    name: "Seznam",
    settings: "Settings (Nastavení) → Filters (Filtry)",
    action: "Forward (Přeposlat)",
    confirmation: "maybe",
    notes: [],
    links: [{ label: "Open Seznam Email", url: "https://email.seznam.cz/" }],
  },
  mailru: {
    name: "Mail.ru",
    settings: "Settings (Настройки) → Filters (Фильтры)",
    action: "Forward (Переслать)",
    confirmation: "likely",
    notes: [],
    links: [{ label: "Open Mail.ru", url: "https://e.mail.ru/" }],
  },
  yandex: {
    name: "Yandex Mail",
    settings: "Settings → Message filtering rules (Правила обработки писем)",
    action: "Forward to address (Переслать по адресу)",
    confirmation: "likely",
    notes: [],
    links: [{ label: "Open Yandex Mail", url: "https://mail.yandex.com/" }],
  },
  qq: {
    name: "QQ Mail",
    settings: "Settings (设置) → Incoming mail rules (收信规则)",
    action: "Auto-forward (自动转发)",
    confirmation: "maybe",
    notes: [CHINA_NOTE],
    links: [{ label: "Open QQ Mail", url: "https://mail.qq.com/" }],
  },
  netease: {
    name: "NetEase Mail",
    settings: "Settings (设置) → Auto-forward (自动转发)",
    action: "Forward (转发)",
    confirmation: "maybe",
    notes: [CHINA_NOTE],
    links: [
      { label: "Open 163.com Mail", url: "https://mail.163.com/" },
      { label: "Open 126.com Mail", url: "https://mail.126.com/" },
    ],
  },
  naver: {
    name: "Naver Mail",
    settings: "Mail settings → Auto-forwarding (메일 자동 전달)",
    action: "Forward (전달)",
    confirmation: "maybe",
    notes: [KOREA_NOTE],
    links: [{ label: "Open Naver Mail", url: "https://mail.naver.com/" }],
  },
  daum: {
    name: "Daum Mail",
    settings: "Settings → Auto-forwarding (자동 전달)",
    action: "Forward (전달)",
    confirmation: "maybe",
    notes: [KOREA_NOTE],
    links: [{ label: "Open Daum Mail", url: "https://mail.daum.net/" }],
  },
};

function regional(mailbox: RegionalMailbox, inbound: string, senders: string[]): ProviderBody {
  const likely = mailbox.confirmation === "likely";
  const confirmStep = likely
    ? `${mailbox.name} will probably email a confirmation link to ${inbound} before it forwards anything. It appears on your Package Radar setup page within a few minutes: open it there to approve forwarding.`
    : `If ${mailbox.name} emails a confirmation to ${inbound}, it will appear on your Package Radar setup page; open it there to approve forwarding.`;
  return {
    steps: senders.length
      ? [
          `Sign in to ${mailbox.name} in a web browser and open ${mailbox.settings}.`,
          `Create a new rule for messages from any of these senders: ${senders.join(", ")}. If a rule only takes one address, make one rule per address.`,
          `Set the rule's action to ${mailbox.action} and enter ${inbound}.`,
          confirmStep,
          "Save the rule.",
        ]
      : [NO_SENDERS_STEP],
    filterQuery: null,
    needsForwardingVerification: likely,
    verificationNote: likely
      ? `${mailbox.name} is expected to send a confirmation link to ${inbound} before forwarding starts. Package Radar shows it on your setup page.`
      : `If ${mailbox.name} sends a confirmation email to ${inbound} first, it will appear on your Package Radar setup page.`,
    caveats: [
      ...mailbox.notes,
      `We haven't been able to test these steps with a ${mailbox.name} account, so menu names may differ.`,
      PARTIAL_FORWARDING_FALLBACK,
      "Package Radar never stores email contents; it keeps only the shipment details it finds and discards the rest.",
    ],
    links: mailbox.links,
  };
}

function other(inbound: string, senders: string[]): ProviderBody {
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
      PARTIAL_FORWARDING_FALLBACK,
      "If your provider can only forward all of your mail, Package Radar keeps only the shipment details it finds and never stores email contents.",
    ],
    links: [],
  };
}

/**
 * Setup copy for forwarding the chosen programs' carrier emails from
 * `provider` to `inboundAddress`. `options.country` picks regional senders
 * (amazon.co.uk etc.); `options.extraSenders` adds e.g. a self-test sender.
 * Unknown providers get the generic "other" steps.
 */
export function buildFilterInstructions(
  provider: EmailProvider,
  inboundAddress: string,
  programIds: ProgramId[],
  options: FilterOptions = {},
): FilterInstructions {
  const id: EmailProvider = isEmailProvider(provider) ? provider : "other";
  const label = PROVIDERS_BY_ID.get(id)?.label ?? "Another email provider";
  const inbound = (typeof inboundAddress === "string" ? inboundAddress.trim() : "") || "your Package Radar address";
  const senders = collectSenders(programIds, options);
  const mailbox = REGIONAL[id];
  const body = mailbox
    ? regional(mailbox, inbound, senders)
    : id === "gmail"
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
