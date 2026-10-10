import Link from "next/link";
import type { GuideMeta } from "./types";

export const meta: GuideMeta = {
  slug: "ups-my-choice",
  title: "UPS My Choice: free vs Premium, the activation letter and alerts",
  description:
    "What the free UPS My Choice membership shows, when Premium (about $19.99 a year) is worth it, how the mailed activation code works and which alerts to turn on.",
  published: "2026-10-08",
  updated: "2026-10-08",
  readingMinutes: 5,
  category: "Carriers",
};

export default function Content() {
  return (
    <>
      <p>
        UPS My Choice is UPS’s program for people receiving packages at home.
        Once you’ve signed up and UPS has confirmed your address, it shows
        the UPS packages headed your way without you entering a single
        tracking number, including packages someone else ordered for you.
        The basic membership is free, and for most people it’s all they need.
      </p>

      <h2>What the free membership shows</h2>
      <ul>
        <li>
          <strong>Incoming packages.</strong> A dashboard of UPS shipments
          coming to your address, with no tracking numbers needed. Outbound
          shipments you send appear too.
        </li>
        <li>
          <strong>A delivery calendar.</strong> UPS shows roughly the past
          four months of deliveries plus anything scheduled.
        </li>
        <li>
          <strong>Estimated delivery windows.</strong> For many packages UPS
          gives a time window on the day of delivery, not just the date.
        </li>
        <li>
          <strong>Alerts</strong> by email, text or the UPS app, for events
          such as the day before delivery, the day of delivery and delivery
          itself.
        </li>
        <li>
          <strong>Delivery changes</strong>, such as rescheduling or leaving
          instructions. Free members can still make changes, but many of
          them carry a per-change fee.
        </li>
      </ul>
      <p>
        UPS’s{" "}
        <a href="https://www.ups.com/us/en/track/ups-my-choice" rel="noopener noreferrer" target="_blank">UPS My Choice page</a>{" "}
        lists the current features for the US. UPS runs the program in many
        other countries too, but says availability varies by location.
      </p>

      <h2>Free vs Premium</h2>
      <p>
        Premium is an optional paid upgrade. It doesn’t show you any more
        packages; it mainly changes what you pay to adjust deliveries.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Free</th>
              <th scope="col">Premium</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Dashboard of incoming packages</td>
              <td>Yes</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>Email, text and app alerts</td>
              <td>Yes</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>Delivery changes</td>
              <td>Many changes cost a fee each time</td>
              <td>Unlimited delivery changes at no added fee</td>
            </tr>
            <tr>
              <td>Price (US)</td>
              <td>Free</td>
              <td>About $19.99 a year at the time of writing</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <strong>Who should pay for Premium?</strong> People who regularly
        reroute or reschedule UPS deliveries, for example because nobody is
        home during the day and packages often need a signature. If you
        mainly want to know what’s coming, the free membership does that
        completely. Prices and fees change, so check UPS’s page before you
        upgrade.
      </p>

      <h2>How to sign up</h2>
      <ol>
        <li>
          Open the{" "}
          <a href="https://www.ups.com/us/en/track/ups-my-choice" rel="noopener noreferrer" target="_blank">UPS My Choice page</a>{" "}
          and choose to sign up. You’ll create a ups.com login, or sign in
          if you already have one.
        </li>
        <li>
          Enter your name and home address the way packages are usually
          addressed to you. UPS matches packages on both, so a nickname or
          an old spelling can cause misses.
        </li>
        <li>
          Confirm your email address with the code UPS sends. The code
          expires quickly, so keep the sign-up tab open while you check your
          inbox.
        </li>
        <li>
          If UPS needs more proof that you live there, it mails an activation
          code to the address (see below).
        </li>
        <li>Choose your alert settings.</li>
      </ol>

      <h2>The activation letter, explained</h2>
      <p>
        Not every member gets one, but when UPS can’t confirm your address
        online it sends a welcome letter with an activation code to the
        address itself. The logic is simple: only someone who can collect
        mail there can finish the sign-up, which stops strangers from
        watching your deliveries.
      </p>
      <ul>
        <li>The letter usually arrives about 7–14 days after you enroll.</li>
        <li>
          The code is only valid for a limited time after the date printed
          on the letter (UPS has said 45 days), so enter it when it arrives.
        </li>
        <li>
          Until you enter it, your membership isn’t fully active, so some
          packages and features may not appear.
        </li>
      </ul>
      <p>
        If the letter never arrives or the code has expired, sign in to
        ups.com and follow the prompts for your membership, or contact UPS
        through its help pages.
      </p>

      <h2>Which alerts to turn on</h2>
      <p>
        My Choice lets you pick alerts by event. The names have changed over
        the years, but they have included:
      </p>
      <ul>
        <li>
          <strong>Ready for Shipment</strong>: a shipper has created a label
          for a package to you.
        </li>
        <li>
          <strong>Day Before Delivery</strong> and{" "}
          <strong>Day of Delivery</strong>: the most useful pair for planning.
        </li>
        <li>
          <strong>Delivery Date Change</strong>: a delay or a new date.
        </li>
        <li>
          <strong>Delivered</strong>: sometimes with a photo of where the
          package was left.
        </li>
        <li>
          <strong>Ready for Pickup</strong>: the package is waiting at a UPS
          location.
        </li>
      </ul>
      <p>
        Choose <strong>email</strong> for at least these events if you want
        to forward them anywhere. Text and app alerts are fine for yourself
        but can’t be forwarded automatically. Genuine My Choice alerts come
        from <code translate="no">mcinfo@ups.com</code>, and notifications started by a
        shipper often come from <code translate="no">pkginfo@ups.com</code>. Scammers can
        fake a sender address, so treat it as a hint rather than proof.
      </p>

      <h2>What a My Choice alert looks like</h2>
      <p>
        UPS alert emails follow a consistent layout, which makes them quick
        to read once you know where to look. Real ones we’ve examined
        include:
      </p>
      <ul>
        <li>
          A subject such as “UPS Update: Package Scheduled for Delivery
          Today”, and a headline like “Your package is arriving today.”
        </li>
        <li>
          A “From” line naming the shipper. This is often a fulfillment or
          logistics company rather than the brand you know: a pharmacy order
          can show its distribution partner, and Amazon orders usually show
          AMAZON.COM.
        </li>
        <li>
          A scheduled delivery date with a time window, for example
          “Thursday 3:15 PM - 5:15 PM”, plus the service, such as UPS Ground.
        </li>
        <li>
          The tracking number, which for UPS usually starts with 1Z, and
          buttons to track the package or change the delivery on ups.com.
        </li>
      </ul>

      <h2>Limits worth knowing</h2>
      <ul>
        <li>
          <strong>UPS only.</strong> USPS, FedEx and Amazon’s own drivers
          aren’t covered. Amazon orders that UPS delivers do appear, usually
          with the shipper shown as Amazon.
        </li>
        <li>
          <strong>Packages appear once UPS knows about them</strong>, usually
          when it has label data or a first scan.
        </li>
        <li>
          <strong>Name matching.</strong> A package addressed to a housemate
          under a different name may not appear on your membership.
        </li>
        <li>
          <strong>Business deliveries</strong> are handled by a separate
          program, UPS My Choice for Business.
        </li>
      </ul>

      <h2>Spotting fake UPS messages</h2>
      <p>
        Scammers copy UPS branding in texts and emails. UPS says genuine
        links start with www.ups.com or billing.ups.com. If a message asks
        you to pay a small fee to release a package or to “confirm” your
        address through a link, don’t tap it: open the UPS app, or type
        ups.com into your browser, and check your My Choice dashboard
        instead. A “delivery problem” that doesn’t appear anywhere on your
        dashboard is another warning sign. Our{" "}
        <Link href="/guides/fake-delivery-text-scams">guide to fake delivery texts</Link>{" "}
        has more red flags.
      </p>

      <h2>Quick answers</h2>
      <h3>Do I need Premium to get alerts?</h3>
      <p>
        No. Alerts and the incoming-package dashboard come with the free
        membership.
      </p>
      <h3>Will it show packages I didn’t order?</h3>
      <p>
        Yes, as long as they’re UPS packages addressed to you at your
        registered address. That includes gifts and, for example, pharmacy
        deliveries sent on your behalf.
      </p>
      <h3>Can I add more than one address?</h3>
      <p>
        Yes. UPS lets members include additional addresses, and the delivery
        calendar shows packages for all of them.
      </p>

      <h2>Adding UPS to Package Radar</h2>
      <p>
        With email alerts on, UPS My Choice is one of the feeds Package Radar
        reads. Forward those UPS emails to your Package Radar address and
        your UPS packages appear on the same list as USPS and FedEx ones. The{" "}
        <Link href="/setup">setup</Link> walks you through the filter, and
        our guide to{" "}
        <Link href="/guides/how-to-see-every-package-coming-to-your-address">seeing every package coming to your address</Link>{" "}
        explains how the programs fit together.
      </p>
    </>
  );
}
