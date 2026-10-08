import type { ShipmentStatus } from "@/lib/types";

/**
 * Shipment status from carrier wording. Rules are checked in order, so a
 * stronger or more specific state wins: "could not be delivered" is an
 * exception before it can look like "delivered", and "Out for Delivery" wins
 * over "shipped". "Scheduled Delivery", "Expected Delivery" and "will be
 * delivered" never count as delivered.
 *
 * Feed it the subject and the opening lines of a body, not whole emails:
 * footers and progress bars ("Ordered · Shipped · Out for delivery · Delivered")
 * mention every state.
 */
const RULES: readonly [ShipmentStatus, readonly RegExp[]][] = [
  [
    "return_to_sender",
    [/\breturn(?:ed|ing)?\s+to\s+(?:the\s+)?(?:sender|shipper)\b/i, /\bbeing\s+returned\b/i],
  ],
  [
    "exception",
    [
      /\b(?:could\s+not|couldn['’]t|cannot|can['’]t|unable\s+to|not\s+able\s+to|was\s+not|wasn['’]t|were\s+not|has\s+not\s+been|have\s+not\s+been)\s+(?:be\s+)?deliver(?:ed)?\b/i,
      /\b(?:delivery|shipment)\s+exception\b/i,
      /\bdelivery\s+attempt(?:ed)?\b|\battempted\s+delivery\b|\b(?:we|driver)\s+(?:tried|attempted)\s+to\s+deliver\b|\bmissed\s+(?:delivery|you)\b/i,
      /\brunning\s+late\b|\b(?:is|are|was|were|has\s+been|have\s+been)\s+delayed\b|\bthere\s+(?:is|was)\s+a\s+delay\b|\bdelay\s+(?:with|in|to)\s+(?:your|the)\b|\bsorry\s+for\s+the\s+delay\b|^\s*delay(?:ed)?\s*[:!-]/im,
      /\b(?:address|delivery)\s+(?:issue|problem)\b|\b(?:incorrect|incomplete|insufficient)\s+address\b|\bheld\s+(?:at|in)\s+customs\b|\bcustoms\s+(?:hold|delay)\b|\b(?:damaged|lost)\s+(?:package|shipment|in\s+transit)\b/i,
    ],
  ],
  [
    "delivered",
    [
      /^\s*delivered\s*[:!]/im,
      /\b(?:has|have)\s+been\s+delivered\b|\b(?:was|were)\s+delivered\b/i,
      /\b(?:item|package|parcel|shipment)s?\s+delivered\b(?!\s+(?:to\s+(?:a|an|another|the\s+ups)|somewhere|elsewhere|faster|on\s+time))/i,
      /\s-\s+delivered\s+-\s/i,
      /\b(?:order|package|parcel)\s+has\s+arrived\b(?!\s+at)/i,
      /\bdelivery\s+(?:complete|completed|successful)\b/i,
    ],
  ],
  [
    "available_for_pickup",
    [
      /\b(?:ready|available)\s+(?:for|to)\s+pick\s?-?up\b/i,
      /\b(?:package|parcel)\s+to\s+pick\s+up\b/i,
      /\bheld\s+for\s+pick\s?-?up\b|\bwaiting\s+for\s+(?:you\s+)?(?:at|to\s+be\s+picked)\b/i,
    ],
  ],
  [
    "out_for_delivery",
    [
      /\bout\s+for\s+delivery\b/i,
      /\barriv(?:ing|es)\s+today\b/i,
      /\bdelivery\s+is\s+today\b|\bscheduled\s+for\s+delivery\s+today\b|\bdelivery\s+scheduled\s+for\s+today\b|\b(?:will\s+be\s+)?delivered\s+today\b/i,
      /\bon\s+(?:the|a|its)\s+(?:fedex\s+|ups\s+)?vehicle\s+for\s+delivery\b|\bwith\s+(?:the\s+)?courier\s+for\s+delivery\b/i,
      /\bdriver\s+is\s+(?:arriving|nearby|close|on\s+the\s+way)\b|\bfollow\s+your\s+delivery\s+on\s+a\s+live\s+map\b|\bpre-?arrival\b/i,
    ],
  ],
  [
    "pre_transit",
    [
      /\blabel\s+(?:has\s+been\s+|was\s+)?created\b|\bshipping\s+label\b(?=[^.\n]{0,40}\bcreated\b)/i,
      /\bshipment\s+information\s+(?:sent|received)\b|\bpre-?shipment\b/i,
      /\bawaiting\s+(?:item|sender|carrier\s+pickup)\b|\b(?:ready|preparing)\s+(?:for|to)\s+ship(?:ment)?\b/i,
      /\b(?:not\s+yet|hasn['’]t|has\s+not)\s+(?:been\s+)?shipped\b|\bwill\s+(?:be\s+)?ship(?:ped)?\b/i,
      /^\s*ordered\s*:/im,
      /\border\s+(?:has\s+been\s+)?(?:confirmed|received|placed)\b/i,
    ],
  ],
  [
    "in_transit",
    [
      /\bshipped\b|\bin\s+transit\b|\bon\s+(?:its|their|the|it['’]s)\s+way\b|\b(?:has\s+been\s+)?dispatched\b/i,
      /\bdeparted\b|\barrived\s+at\b|\bpicked\s+up\s+by\b|\bon\s+the\s+move\b/i,
      /\b(?:expected|scheduled|estimated)\s+(?:for\s+)?delivery\b|\bwill\s+be\s+delivered\b|\barriving\b|\bnew\s+(?:scheduled\s+)?delivery\s+date\b/i,
    ],
  ],
];

/** Status a piece of carrier text announces, or null when it says nothing recognizable. */
export function statusFromText(text: string): ShipmentStatus | null {
  if (!text) return null;
  for (const [status, patterns] of RULES) {
    if (patterns.some((re) => re.test(text))) return status;
  }
  return null;
}

/** States a body may upgrade a vaguer subject to ("Expected Delivery on ..." subject, "out for delivery" body). */
const BODY_UPGRADES: ReadonlySet<ShipmentStatus> = new Set<ShipmentStatus>([
  "out_for_delivery",
  "exception",
  "available_for_pickup",
  "return_to_sender",
  "delivered",
]);

/**
 * Status from a subject and a body lead: the subject decides unless it is
 * missing or only says pre-transit / in transit and the body names a later or
 * side state.
 */
export function combineStatus(subject: ShipmentStatus | null, body: ShipmentStatus | null): ShipmentStatus | null {
  if (subject === null) return body;
  if ((subject === "in_transit" || subject === "pre_transit") && body !== null && BODY_UPGRADES.has(body)) return body;
  return subject;
}

const SCHEMA_STATUS: Record<string, ShipmentStatus> = {
  orderdelivered: "delivered",
  orderintransit: "in_transit",
  orderpickupavailable: "available_for_pickup",
  orderproblem: "exception",
  orderreturned: "return_to_sender",
  orderprocessing: "pre_transit",
  orderpaymentdue: "pre_transit",
};

/** Status from a schema.org OrderStatus value ("http://schema.org/OrderInTransit") or free text. */
export function statusFromSchema(value: string | null): ShipmentStatus | null {
  if (!value) return null;
  const key = value.replace(/^https?:\/\/schema\.org\//i, "").trim().toLowerCase();
  return SCHEMA_STATUS[key] ?? statusFromText(value);
}
