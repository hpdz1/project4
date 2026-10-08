import type { InboundEmail } from "@/lib/types";
import { addDays, formatMailDate, isValidTimeZone, localDateIn, weekdayOf, zonedTime } from "./dates";

/**
 * Realistic synthetic carrier emails for demo mode and tests. Formats follow
 * research/carrier-emails.md §9 (modeled on real templates); every name,
 * address and number is fake. Tracking numbers are checksum-valid test
 * numbers. Dates are relative to `now` in `timezone`.
 */

export interface SampleOptions {
  now: Date;
  /** Inbound alias local part, e.g. "r-k3j9x2m4q8w1". */
  alias: string;
  inboundDomain: string;
  /** IANA zone of the delivery address; defaults to America/New_York. */
  timezone?: string;
}

export const SAMPLE_TIMEZONE = "America/New_York";

/** The sample user's own mailbox (the forwarding Gmail account). */
export const SAMPLE_USER_EMAIL = "sam.example@gmail.com";

/** Tracking numbers used by the samples (all pass their check digits). */
export const SAMPLE_TRACKING = {
  uspsToday: "9400111899223197428497",
  uspsSoon: "9205590199999999999905",
  uspsDelivered: "9405509999999999991239",
  ups: "1Z999AA10987654328",
  fedex: "398765432103",
} as const;

export const SAMPLE_AMAZON_ORDER = "112-4589301-7765432";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function parts(date: string) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const weekday = WEEKDAYS[weekdayOf(date)];
  return { y, m, d, mm: date.slice(5, 7), dd: date.slice(8, 10), weekday, wd: weekday.slice(0, 3), month: MONTHS[m - 1], mon: MONTHS[m - 1].slice(0, 3) };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Six sample emails, oldest first:
 * 1. USPS delivered notification for a separate package (yesterday afternoon);
 * 2. UPS My Choice "Package Scheduled for Delivery Tomorrow";
 * 3. USPS Informed Delivery Daily Digest for today (one package today, one in 2 days);
 * 4. FedEx Delivery Manager "on its way" (expected in 3 days, number in a FedEx tracking link);
 * 5. Amazon "Shipped:" (order number and item, arriving in 4 days);
 * 6. Gmail forwarding confirmation for the inbound address.
 * Carrier emails look auto-forwarded by Gmail (original From kept, X-Forwarded-To = the alias).
 */
export function sampleEmails(opts: SampleOptions): InboundEmail[] {
  const tz = opts.timezone && isValidTimeZone(opts.timezone) ? opts.timezone : SAMPLE_TIMEZONE;
  const inbound = `${opts.alias}@${opts.inboundDomain}`.toLowerCase();
  const nowMs = opts.now.getTime();
  const today = localDateIn(opts.now, tz);
  const midnight = zonedTime(today, 0, 0, tz).getTime();

  /** Today at hh:mm local, but never after `now` (minus a minute) nor before local midnight. */
  const sentToday = (hour: number, minute: number): Date =>
    new Date(Math.max(midnight + 60_000, Math.min(zonedTime(today, hour, minute, tz).getTime(), nowMs - 60_000)));

  const forwarded = (fields: Omit<InboundEmail, "recipients" | "headers" | "date">, date: Date, extra: Record<string, string> = {}): InboundEmail => ({
    ...fields,
    recipients: [inbound, SAMPLE_USER_EMAIL],
    headers: {
      date: formatMailDate(date, tz),
      to: SAMPLE_USER_EMAIL,
      "delivered-to": SAMPLE_USER_EMAIL,
      "x-forwarded-to": inbound,
      "x-forwarded-for": `${SAMPLE_USER_EMAIL} ${inbound}`,
      "message-id": `<sample-${fields.subject.length}-${date.getTime()}@example.invalid>`,
      ...extra,
    },
    date: date.toISOString(),
  });

  return [
    uspsDelivered(addDays(today, -1), zonedTime(addDays(today, -1), 14, 41, tz), forwarded),
    upsTomorrow(addDays(today, 1), sentToday(6, 12), forwarded),
    uspsDigest(today, addDays(today, 2), sentToday(7, 5), forwarded),
    fedexOnItsWay(addDays(today, 3), sentToday(9, 30), forwarded),
    amazonShipped(addDays(today, 4), sentToday(10, 47), forwarded),
    gmailConfirmation(inbound, sentToday(23, 59), tz),
  ];
}

type Forward = (fields: Omit<InboundEmail, "recipients" | "headers" | "date">, date: Date, extra?: Record<string, string>) => InboundEmail;

function uspsDigest(today: string, soon: string, sent: Date, forwarded: Forward): InboundEmail {
  const t = parts(today);
  const s = parts(soon);
  const { uspsToday, uspsSoon } = SAMPLE_TRACKING;
  const pkg = (shipper: string, tn: string, eta?: string) => `
<table role="presentation" width="100%"><tbody><tr><td style="padding:8px 0">
<p id="pra-shipper-name-td-id" align="left" style="font-weight:bold"> ${shipper}</p>
<p align="left"><a id="tracking-number-href-id" href="https://informeddelivery.usps.com/box/pages/secure/packageDashboardAction?selectedTrckNum=${tn}&amp;selectedTypeOfLabel=Package"><span id="pra-tracking-number-id"> ${tn}</span></a></p>${
    eta ? `\n<p id="pra-expected-delivery-date" align="left"> Estimated Delivery on: ${eta}</p>` : ""
  }
</td></tr></tbody></table>`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>USPS Informed Delivery Daily Digest</title>
<style>p{margin:0;font-family:Arial,sans-serif}</style></head>
<body>
<table role="presentation" width="100%"><tr><td>
<p style="font-size:20px">COMING TO YOU SOON</p>
<p>Hi, Sam!</p>
<p>You have <span id="total-mailpieces">3</span> mailpiece(s) and <span id="total-packages">2</span> inbound package(s) arriving soon.</p>
</td></tr></table>
<h2>MAIL</h2>
<p>3 item(s) expected today. <a href="https://informeddelivery.usps.com/box/pages/secure/DashboardAction_input.action">View Dashboard</a></p>
<h2>PACKAGES</h2>
<span> Arriving Today</span><span id="today-date-span-id"> ${t.weekday}, ${t.mon} ${t.dd}</span>
<div id="today-package-div">${pkg("EXAMPLE OUTFITTERS CO", uspsToday)}
</div>
<span> Arriving Soon</span>
<div id="soon-package-div">${pkg("ACME WIDGETS FULFILLMENT", uspsSoon, `${s.weekday}, ${s.mon} ${s.dd}`)}
</div>
<span> Outbound </span>
<table role="presentation"><tr id="no-package-available-outbound-tr"><td><p>No packages available to display.</p></td></tr></table>
<div id="outbound-package-div"></div>
<p style="font-size:11px">You may have more mail or packages than are shown in your Daily Digest. To check, go to your Dashboard.</p>
<p style="font-size:11px">This is an automated email. Please do not reply. Sample message generated by Package Radar demo mode.</p>
</body></html>`;
  const text = `COMING TO YOU SOON
Hi, Sam!
You have 3 mailpiece(s) and 2 inbound package(s) arriving soon.
${t.weekday} ${t.d} ${t.month} ${t.y}
MAIL View Dashboard
Expected Today
3 item(s)
PACKAGES View Dashboard
Expected Today
EXAMPLE OUTFITTERS CO
${uspsToday}
Expected Soon
ACME WIDGETS FULFILLMENT
${uspsSoon}
Estimated Delivery on: ${s.weekday}, ${s.mon} ${s.dd}
You may have more mail or packages than are shown in your Daily Digest. To check, go to your Dashboard.`;
  return forwarded(
    {
      from: "uspsinformeddelivery@email.informeddelivery.usps.com",
      fromName: "USPS Informed Delivery",
      subject: `Your Daily Digest for ${t.wd}, ${t.m}/${t.d} is ready to view`,
      text,
      html,
    },
    sent,
  );
}

function upsTomorrow(day: string, sent: Date, forwarded: Forward): InboundEmail {
  const p = parts(day);
  const tn = SAMPLE_TRACKING.ups;
  const when = `${p.weekday} ${p.mm}/${p.dd}/${p.y}`;
  const track = `https://www.ups.com/track?loc=en_US&Requester=SBN&tracknum=${tn}&AgreeToTermsAndConditions=yes`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>UPS Update</title></head>
<body style="background:#f2f2f2">
<table role="presentation" width="100%"><tr><td>
<p id="salutation">Hi Sam,</p>
<h1 id="headline">Your package is arriving tomorrow.</h1>
<p><span id="shipperAndArrival">From <strong>NORTHWIND HOME GOODS</strong></span></p>
<table role="presentation">
<tr><td id="deliveryDateTimeLabel">Scheduled Delivery</td></tr>
<tr><td id="deliveryDateTime">${when} 9:00 AM - 1:00 PM</td></tr>
</table>
<p><a id="cta" href="${escapeHtml(track)}">Track Your Package</a></p>
<p id="shipTo">Ship To<br>SAM EXAMPLE<br>123 EXAMPLE ST<br>SPRINGFIELD, ZZ 00000<br>US</p>
<p id="serviceName">UPS Ground</p>
<p>Tracking Number: <span id="trackingNumber">${tn}</span></p>
<p id="dcrLoginMessage">Not going to be home? <a href="https://www.ups.com/deliverychange?loc=en_US&amp;trackingNumber=${tn}">Log in to change your delivery.</a></p>
<p style="font-size:11px">Questions? Visit the UPS Help Center or call 1-800-742-5877. Sample message generated by Package Radar demo mode.</p>
</td></tr></table>
</body></html>`;
  const text = `Hi Sam,
Your package is arriving tomorrow.
From NORTHWIND HOME GOODS
Scheduled Delivery
${when}
9:00 AM - 1:00 PM
Track Your Package
${track}
Ship To
SAM EXAMPLE
123 EXAMPLE ST
SPRINGFIELD, ZZ 00000
US
UPS Ground
Tracking Number: ${tn}
Not going to be home?
Log in to change your delivery.`;
  return forwarded(
    { from: "mcinfo@ups.com", fromName: "UPS", subject: "UPS Update: Package Scheduled for Delivery Tomorrow", text, html },
    sent,
  );
}

function fedexOnItsWay(day: string, sent: Date, forwarded: Forward): InboundEmail {
  const p = parts(day);
  const tn = SAMPLE_TRACKING.fedex;
  const date = `${p.wd}, ${p.mm}/${p.dd}/${p.y}`;
  const track = `https://www.fedex.com/fedextrack/?trknbr=${tn}&trkqual=12026~${tn}~FDEG`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>FedEx</title></head>
<body>
<table role="presentation" width="100%"><tr><td>
<p>Hi, Sam. Your package from Contoso Electronics is on its way.</p>
<p><a href="${escapeHtml(track)}" style="background:#4d148c;color:#fff;padding:10px 16px">TRACK YOUR PACKAGE</a></p>
<table role="presentation">
<tr><td>SCHEDULED DELIVERY</td></tr><tr><td>${date}</td></tr>
<tr><td>by end of day</td></tr>
<tr><td>TRACKING NUMBER</td></tr><tr><td><a href="${escapeHtml(track)}">${tn}</a></td></tr>
<tr><td>FROM</td></tr><tr><td>Contoso Electronics<br>500 COMMERCE PKWY<br>ANYTOWN, ZZ, US, 00001</td></tr>
<tr><td>TO</td></tr><tr><td>Sam Example<br>123 EXAMPLE ST<br>SPRINGFIELD, ZZ, US, 00000</td></tr>
<tr><td>SERVICE TYPE</td></tr><tr><td>FedEx Home Delivery</td></tr>
</table>
<p style="font-size:11px">You are receiving this email because you are enrolled in FedEx Delivery Manager. Sample message generated by Package Radar demo mode.</p>
</td></tr></table>
</body></html>`;
  const text = `Hi, Sam. Your package from Contoso Electronics is on its way.
TRACK YOUR PACKAGE <${track}>
SCHEDULED DELIVERY
${date}
by end of day
TRACKING NUMBER
${tn}
FROM
Contoso Electronics
500 COMMERCE PKWY
ANYTOWN, ZZ, US, 00001
TO
Sam Example
123 EXAMPLE ST
SPRINGFIELD, ZZ, US, 00000
SERVICE TYPE
FedEx Home Delivery`;
  return forwarded(
    {
      from: "trackingupdates@fedex.com",
      fromName: "FedEx Delivery Manager",
      subject: `FedEx Shipment ${tn}: Your package is on its way`,
      text,
      html,
    },
    sent,
    { "reply-to": "trackingmail@fedex.com" },
  );
}

function amazonShipped(day: string, sent: Date, forwarded: Forward): InboundEmail {
  const p = parts(day);
  const order = SAMPLE_AMAZON_ORDER;
  const item = "Trailblazer Insulated Water Bottle, 32 oz, Slate";
  const track = `https://www.amazon.com/progress-tracker/package?_encoding=UTF8&orderId=${order}&packageIndex=0&shipmentId=Gx7Kp2LmQ&vt=NOTIFICATIONS`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Amazon.com</title></head>
<body>
<table role="presentation" width="100%"><tr><td>
<p>Hello Sam,</p>
<h2>Your package was shipped!</h2>
<table role="presentation"><tr><td>Ordered</td><td>Shipped</td><td>Out for delivery</td><td>Delivered</td></tr></table>
<p><b>Arriving ${p.weekday}</b></p>
<p>Sam - SPRINGFIELD, ZZ</p>
<p>Order #<br>${order}</p>
<p><a href="${escapeHtml(track)}">Track package</a></p>
<table role="presentation">
<tr><td>* ${item}</td></tr>
<tr><td>Quantity: 1</td></tr>
<tr><td>$24.99</td></tr>
</table>
<p style="font-size:11px">Sample message generated by Package Radar demo mode.</p>
</td></tr></table>
</body></html>`;
  const text = `Hello Sam,
    Your package was shipped!
Ordered
Shipped
Out for delivery
Delivered
Arriving ${p.weekday}
Sam - SPRINGFIELD, ZZ
Order #
${order}
Track package
${track}
* ${item}
  Quantity: 1
  $24.99`;
  return forwarded(
    {
      from: "shipment-tracking@amazon.com",
      fromName: "Amazon.com",
      subject: `Shipped: "Trailblazer Insulated Water Bottle..."`,
      text,
      html,
    },
    sent,
    { "reply-to": "no-reply@amazon.com" },
  );
}

function uspsDelivered(day: string, sent: Date, forwarded: Forward): InboundEmail {
  const p = parts(day);
  const tn = SAMPLE_TRACKING.uspsDelivered;
  const track = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tn}&utm_source=delivered&utm_medium=email&utm_content=tracking-number&utm_campaign=trackingnotify`;
  const sentence = `Your item was delivered at the front door or porch at 2:41 pm on ${p.month} ${p.d}, ${p.y} in SPRINGFIELD, ZZ 00000.`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>USPS</title></head>
<body>
<p>Hello Sam Example,</p>
<p>${sentence}</p>
<p>Tracking Number: <a href="${escapeHtml(track)}">${tn}</a></p>
<p><strong>Delivered, Front Door/Porch</strong></p>
<p style="font-size:11px">This is an automated email; please do not reply. Sample message generated by Package Radar demo mode.</p>
</body></html>`;
  const text = `Hello Sam Example,
${sentence}
Tracking Number: ${tn}
${track}
Delivered, Front Door/Porch`;
  return forwarded(
    { from: "auto-reply@usps.com", fromName: "USPS", subject: `USPS® Item Delivered, Front Door/Porch ${tn}`, text, html },
    sent,
  );
}

function gmailConfirmation(inbound: string, sent: Date, tz: string): InboundEmail {
  const token = "ANGjdJ8sAmPlEtOkEn4dEmO-OnLy0x9QzW2vR7uKpL3mN5bC1dF6gH8jT0yU";
  const confirm = `https://mail-settings.google.com/mail/vf-%5B${token}%5D-dEmOsAmPlE0nLy`;
  const cancel = `https://mail-settings.google.com/mail/uf-%5B${token}%5D-dEmOsAmPlE0nLy`;
  const user = SAMPLE_USER_EMAIL;
  const text = `${user} has requested to automatically forward mail to your email
address ${inbound}.

To allow ${user} to forward mail to your address automatically,
please click the link below to confirm the request:

${confirm}

If you click the link and it appears to be broken, please copy and paste it
into a new browser window.

Thanks for using Gmail!

Sincerely,

The Gmail Team

If you do not approve of this request, no further action is required.
${user} cannot automatically forward messages to your email address
unless you confirm the request by clicking the link above. If you accidentally
clicked the link, but you do not want to allow ${user} to
automatically forward messages to your address, click this link to cancel this
verification:
${cancel}

To learn more about why you might have received this message, please
visit: http://support.google.com/mail/bin/answer.py?answer=184973.`;
  return {
    recipients: [inbound],
    from: "forwarding-noreply@google.com",
    fromName: "Gmail Team",
    subject: `(Gmail Forwarding Confirmation - Receive Mail from ${user}`,
    text,
    html: "",
    headers: {
      date: formatMailDate(sent, tz),
      to: inbound,
      "x-google-address-confirmation": "sample",
      "message-id": `<sample-confirmation-${sent.getTime()}@mail.gmail.com>`,
    },
    date: sent.toISOString(),
  };
}
