import Link from "next/link";
import type { GuideMeta } from "./types";

export const meta: GuideMeta = {
  slug: "package-says-delivered-but-not-here",
  title: "Package says delivered but it’s not here: a 48-hour checklist",
  description:
    "Tracking says delivered but there’s nothing at the door? Work through this 48-hour checklist, then follow the right next step for USPS, UPS, FedEx or Amazon.",
  published: "2026-10-08",
  updated: "2026-10-08",
  readingMinutes: 5,
  category: "Troubleshooting",
};

export default function Content() {
  return (
    <>
      <p>
        Few things are more annoying than a “Delivered” notification with
        nothing on the doorstep. The good news is that a package marked
        delivered often turns up nearby: tucked out of sight, taken in by
        someone else, or left at a neighbor’s. Work through this checklist in
        order. Most of it takes minutes, and it also gathers the details the
        seller or carrier will ask for if the package really is missing.
      </p>

      <h2>In the first hour</h2>
      <ol>
        <li>
          <strong>Read the delivery details, not just the status.</strong>{" "}
          Open the tracking page or the carrier’s delivery email and look at
          where it says the package was left. USPS, for example, may say
          “Front Desk/Reception/Mail Room” or “Left with Individual”. Check
          the delivery time too.
        </li>
        <li>
          <strong>Look at the delivery photo if there is one.</strong> UPS
          and FedEx delivery emails can include a photo of where the package
          was left. Compare the door, step and house number with yours; a
          photo of a different door usually means it went to the wrong
          address.
        </li>
        <li>
          <strong>Search the whole property.</strong> Check behind planters
          and furniture, by the side and back doors, in the garage, in or
          behind the mailbox, and in any parcel locker. Small packages
          sometimes go in the mailbox; flat ones get slid under mats.
        </li>
        <li>
          <strong>In an apartment building</strong>, check the mailroom,
          front desk, leasing office and package lockers. Lockers often send
          their own pickup code by email or text.
        </li>
        <li>
          <strong>Ask everyone in your home.</strong> Someone may have
          brought it in, signed for it or moved it.
        </li>
        <li>
          <strong>Check the address on the order.</strong> An old address, a
          missing apartment number or a typo in the house number explains a
          surprising number of “missing” packages.
        </li>
      </ol>

      <h2>What the delivery scan is telling you</h2>
      <p>
        The wording on the delivery scan is your best clue to where to look
        first. Carriers phrase it differently, but it usually falls into one
        of these groups:
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">The scan says it was…</th>
              <th scope="col">Where to look</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Left at a front desk, reception or mail room</td>
              <td>Ask building staff, and check the mailroom log or lockers.</td>
            </tr>
            <tr>
              <td>Left with an individual</td>
              <td>Ask everyone at home, then neighbors; someone took it in.</td>
            </tr>
            <tr>
              <td>Left at the door or porch</td>
              <td>Search the property, then check the photo and cameras.</td>
            </tr>
            <tr>
              <td>In the mailbox or a parcel locker</td>
              <td>Check the mailbox and any locker key or pickup code.</td>
            </tr>
            <tr>
              <td>Delivered, with no location</td>
              <td>Work through the whole checklist, starting with the photo.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Later the same day</h2>
      <ol>
        <li>
          <strong>Ask your neighbors</strong>, especially those with a
          similar house number or on the same floor. Packages do get left at
          the wrong door, and a quick knock often solves the mystery.
        </li>
        <li>
          <strong>Check doorbell or security cameras</strong>, yours or a
          neighbor’s, around the delivery time.
        </li>
        <li>
          <strong>Check tracking again on the carrier’s own site</strong>,
          typed in yourself rather than from a link in a message. Sometimes
          the status is corrected or more detail appears later.
        </li>
      </ol>
      <p>
        Be wary of any text that arrives at this moment offering to “locate”
        your package for a fee. Scammers know people are anxious about
        deliveries; our{" "}
        <Link href="/guides/fake-delivery-text-scams">guide to fake delivery texts</Link>{" "}
        explains the tricks.
      </p>

      <h2>Give it 24 hours</h2>
      <p>
        If you’ve done all of the above, wait until the end of the next day
        before escalating. Packages are sometimes scanned as delivered a
        little early, or delivered to the wrong door and returned by a
        neighbor later. Use the time to save evidence:
        screenshots of the tracking page and delivery photo, the order
        confirmation, and any notes from neighbors.
      </p>

      <h2>After 24 hours: contact the seller or the carrier</h2>
      <p>
        <strong>If you bought it, go to the seller first.</strong> The seller
        paid for the shipping, so they are the carrier’s customer. They can
        ask the carrier to investigate, and they decide on replacements and
        refunds. Marketplaces have their own “didn’t receive it” process in
        the order page.
      </p>
      <p>
        <strong>If it was a gift or something you sent</strong>, the person
        who paid for the shipping should contact the carrier, with the
        tracking number. Here’s where to start with each carrier:
      </p>

      <h3>USPS</h3>
      <ul>
        <li>
          Check the tracking page at{" "}
          <a href="https://www.usps.com/" rel="noopener noreferrer" target="_blank">usps.com</a>{" "}
          and, if you use it, your{" "}
          <Link href="/guides/usps-informed-delivery">Informed Delivery</Link>{" "}
          dashboard.
        </li>
        <li>
          Contact USPS through the help section of usps.com to open a
          request about the delivery. Have the tracking number and the
          delivery scan details ready.
        </li>
        <li>
          If it still hasn’t appeared after about a week, USPS’s Missing
          Mail search is the next step. At the time of writing USPS asks you
          to wait at least seven days before using it, so check usps.com for
          the current timing.
        </li>
      </ul>

      <h3>UPS</h3>
      <ul>
        <li>
          Check the package on ups.com or in the UPS app. If you’re a{" "}
          <Link href="/guides/ups-my-choice">UPS My Choice</Link> member,
          your dashboard shows the delivery details too.
        </li>
        <li>
          Report the problem through UPS’s online help for that tracking
          number. Have the delivery photo and your neighbors’ answers ready.
        </li>
      </ul>

      <h3>FedEx</h3>
      <ul>
        <li>
          Check the package on fedex.com or in the FedEx app. If you use{" "}
          <Link href="/guides/fedex-delivery-manager">FedEx Delivery Manager</Link>
          , the delivery email may include a photo.
        </li>
        <li>
          Contact FedEx customer support through fedex.com with the tracking
          number.
        </li>
      </ul>

      <h3>Amazon</h3>
      <ul>
        <li>
          Start from the order in{" "}
          <a href="https://www.amazon.com/gp/css/order-history" rel="noopener noreferrer" target="_blank">Your Orders</a>
          , which shows the delivery status and the help options for that
          order, whichever carrier delivered it.
        </li>
        <li>
          If someone else ordered it for you, only they can see it in their
          account, so ask them to start the claim.
        </li>
      </ul>

      <h2>Day two: if it still hasn’t turned up</h2>
      <ul>
        <li>
          <strong>Follow up with the seller</strong> if you haven’t heard
          back, and keep everything in writing.
        </li>
        <li>
          <strong>If you think it was stolen</strong>, file a police report.
          Some sellers, card issuers and insurers ask for a report number.
          If mail was stolen, you can also contact the{" "}
          <a href="https://www.uspis.gov/" rel="noopener noreferrer" target="_blank">US Postal Inspection Service</a>
          .
        </li>
        <li>
          <strong>If the seller won’t help</strong>, ask your card issuer
          whether you can dispute the charge for goods you didn’t receive.
        </li>
      </ul>

      <h2>How to avoid the next one</h2>
      <ul>
        <li>
          <strong>Get alerts before and on delivery day.</strong> The
          carriers’ free address programs email you the day before, on the
          day and on delivery, so you can bring a package in quickly. Our
          guide to{" "}
          <Link href="/guides/how-to-see-every-package-coming-to-your-address">seeing every package coming to your address</Link>{" "}
          shows how to set them up.
        </li>
        <li>
          <strong>Hold deliveries when you’re away.</strong> FedEx Delivery
          Manager includes a free vacation hold of up to 14 days, and USPS
          and UPS offer their own ways to hold or redirect deliveries.
        </li>
        <li>
          <strong>Use a pickup point or locker</strong> for valuable orders
          if you’re rarely home.
        </li>
        <li>
          <strong>Watch one list, not four.</strong> Package Radar puts your
          carriers’ alerts on one page, so “delivered” shows up the moment
          the carrier emails you, whoever the carrier is. See the{" "}
          <Link href="/setup">setup</Link> if that would help.
        </li>
      </ul>
    </>
  );
}
