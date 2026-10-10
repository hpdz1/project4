import Link from "next/link";
import type { GuideMeta } from "./types";

export const meta: GuideMeta = {
  slug: "fake-delivery-text-scams",
  title: "Fake USPS, UPS and FedEx delivery texts: how to spot and report them",
  description:
    "Fake package-delivery texts topped the FTC’s text-scam reports for 2024. How they work, the red flags, what to do if you tapped the link, and where to report.",
  published: "2026-10-08",
  updated: "2026-10-08",
  readingMinutes: 5,
  category: "Safety",
};

export default function Content() {
  return (
    <>
      <p>
        If you’ve had a text like the one below, you’re far from alone.
        Federal Trade Commission data published in April 2025 ranked fake
        package-delivery texts as the most-reported text message scam of
        2024, in a year when reported losses to text scams overall reached
        about $470 million.
      </p>
      <blockquote>
        <p>
          USPS: Your package is on hold due to an incomplete address. Please
          update your details within 12 hours or it will be returned: [link]
        </p>
      </blockquote>
      <p>
        The carrier name changes (USPS, UPS, FedEx, DHL) and so does the
        excuse, but the goal is always the same: get you onto a fake website
        and collect your personal and payment details. Here’s how the scam
        works, how to spot it, and exactly what to do.
      </p>

      <h2>How the scam works</h2>
      <p>
        Criminals send these messages in bulk, knowing that on any given day
        a large share of people really are waiting for a package. The text
        claims a delivery problem, often an “incomplete address” or an
        unpaid “redelivery fee”, and links to a site that copies the
        carrier’s logo and colors.
      </p>
      <p>
        The site usually asks you to “confirm” your name and address first,
        which feels harmless. Then it asks for a small payment, often just a
        few dollars, to reschedule delivery. That’s when it collects your
        card number, and some versions also ask for your date of birth or
        Social Security number. The US Postal Inspection Service calls this
        “smishing” (SMS phishing) and describes the pattern in its{" "}
        <a href="https://www.uspis.gov/news/scam-article/smishing-package-tracking-text-scams" rel="noopener noreferrer" target="_blank">warning about package tracking text scams</a>
        . The small fee is the bait; the real prize is your card details and
        identity, which can be used for much bigger charges later.
      </p>

      <h2>Red flags</h2>
      <ul>
        <li>
          <strong>You never signed up for texts.</strong> USPS says it won’t
          text or email you about a package unless you first asked for
          updates using the tracking number, and that even then its messages
          won’t contain a link.
        </li>
        <li>
          <strong>The link isn’t the carrier’s own website.</strong> Look
          closely at the address. UPS says genuine links start with
          www.ups.com or billing.ups.com. Scam links often use extra words,
          hyphens or unfamiliar endings to look official.
        </li>
        <li>
          <strong>It asks you to pay to get a package delivered.</strong>{" "}
          Carriers can collect import charges on some international
          shipments, but a text demanding a small fee through a link is a
          classic scam sign. Check by going to the carrier’s site yourself.
        </li>
        <li>
          <strong>It asks you to confirm your address.</strong> The carrier
          already has your address; it’s printed on the label.
        </li>
        <li>
          <strong>It rushes you.</strong> “Within 12 hours” or “will be
          returned to sender” is pressure designed to stop you from
          thinking.
        </li>
        <li>
          <strong>No tracking number, or one that doesn’t match any of your
          orders.</strong> A real carrier message is about a specific
          shipment.
        </li>
        <li>
          <strong>It comes from an unfamiliar number or an email
          address</strong>, often with odd spelling or formatting.
        </li>
      </ul>

      <h2>How to check a delivery safely</h2>
      <p>
        Never use the link or phone number in a suspicious message. Instead,
        open the carrier’s app or type its address (usps.com, ups.com or
        fedex.com) into your browser yourself, then enter the tracking number
        from the shop’s order confirmation. If you use the carriers’ free
        address programs, such as{" "}
        <Link href="/guides/usps-informed-delivery">USPS Informed Delivery</Link>
        ,{" "}
        <Link href="/guides/ups-my-choice">UPS My Choice</Link> or{" "}
        <Link href="/guides/fedex-delivery-manager">FedEx Delivery Manager</Link>
        , sign in and look there. A “delivery problem” that appears nowhere in
        your own accounts is a strong sign the text is fake.
      </p>

      <h2>What genuine carrier messages look like</h2>
      <p>
        Knowing what the real thing looks like makes fakes easier to spot.
        These details come from real carrier emails and the carriers’ own
        guidance:
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Carrier</th>
              <th scope="col">What genuine messages look like</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>USPS</td>
              <td>
                Texts only if you asked for updates with a tracking number,
                and no links in them. Tracking emails come from{" "}
                <code translate="no">auto-reply@usps.com</code>; Informed Delivery digests
                currently come from an address ending in{" "}
                <code translate="no">informeddelivery.usps.com</code>.
              </td>
            </tr>
            <tr>
              <td>UPS</td>
              <td>
                Links start with www.ups.com or billing.ups.com. UPS My
                Choice alerts come from <code translate="no">mcinfo@ups.com</code>.
              </td>
            </tr>
            <tr>
              <td>FedEx</td>
              <td>
                Delivery Manager alerts come from{" "}
                <code translate="no">TrackingUpdates@fedex.com</code> and name a specific
                tracking number and shipper.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        One important caveat: a sender’s name or address can be faked, so
        a familiar-looking sender is a hint, not proof. The safest habit is
        the same for every carrier: never pay or enter personal details from
        a link in a message, and check the delivery on the carrier’s own
        site or app instead.
      </p>

      <h2>What to do with a scam text</h2>
      <ol>
        <li>
          <strong>Don’t tap the link and don’t reply</strong>, not even
          “STOP”. A reply tells the sender your number is active.
        </li>
        <li>
          <strong>Forward the text to 7726</strong> (the digits spell SPAM).
          This reports it to your mobile carrier so it can block similar
          messages.
        </li>
        <li>
          <strong>For messages pretending to be USPS</strong>, the Postal
          Inspection Service also accepts reports by email at{" "}
          <code translate="no">spam@uspis.gov</code>.
        </li>
        <li>
          <strong>Report it to the FTC</strong> at{" "}
          <a href="https://reportfraud.ftc.gov/" rel="noopener noreferrer" target="_blank">ReportFraud.ftc.gov</a>
          . Reports help investigators spot patterns.
        </li>
        <li>
          <strong>Delete the message</strong> and block the number.
        </li>
      </ol>

      <h2>If you already tapped the link or paid</h2>
      <p>
        Act quickly, but don’t panic. What matters is what you typed in.
      </p>
      <ul>
        <li>
          <strong>You only opened the page.</strong> Close it and don’t enter
          anything. Keep your phone’s software up to date.
        </li>
        <li>
          <strong>You entered card details or paid the “fee”.</strong> Call
          your bank or card issuer using the number on the back of your card.
          Tell them it was a scam, ask them to cancel the card and dispute the
          charge, and watch your statements for the next few months.
        </li>
        <li>
          <strong>You entered a password</strong>, for example on a fake
          carrier sign-in page. Change it right away, along with any other
          account that uses the same password, and turn on two-step
          verification where it’s offered.
        </li>
        <li>
          <strong>You gave your Social Security number or date of
          birth.</strong> Consider placing a fraud alert or a credit freeze
          with the credit bureaus, and report what happened at{" "}
          <a href="https://reportfraud.ftc.gov/" rel="noopener noreferrer" target="_blank">ReportFraud.ftc.gov</a>
          .
        </li>
      </ul>
      <p>
        It’s also worth reporting a USPS-themed scam to the{" "}
        <a href="https://www.uspis.gov/" rel="noopener noreferrer" target="_blank">US Postal Inspection Service</a>{" "}
        even after the fact.
      </p>

      <h2>Why Package Radar never asks for card details or carrier passwords</h2>
      <p>
        Package Radar exists to answer “is anything on the way to my home?”,
        and we built it so that it can’t be confused with these scams. We
        never ask you to pay to release or redeliver a package, never ask for
        card details, and never ask for your carrier passwords or for codes a
        carrier sends you. We also never claim to look up packages from an
        address alone; nobody legitimate can.
      </p>
      <p>
        Instead, you sign up for the carriers’ own programs on their own
        websites, and forward the alert emails they send you. If a message
        claiming to be from Package Radar ever asks for payment, a password
        or a card number, it isn’t from us. Our{" "}
        <Link href="/privacy">privacy policy</Link> explains what we do
        store.
      </p>
      <p>
        Want fewer surprises in the first place? Once the real carrier
        programs are on, you’ll know which packages are actually coming,
        which makes a fake “delivery problem” much easier to spot. Our guide
        to{" "}
        <Link href="/guides/how-to-see-every-package-coming-to-your-address">seeing every package coming to your address</Link>{" "}
        explains how.
      </p>
    </>
  );
}
