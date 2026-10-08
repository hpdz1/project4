import Link from "next/link";
import type { GuideMeta } from "./types";

export const meta: GuideMeta = {
  slug: "usps-informed-delivery",
  title: "USPS Informed Delivery: sign-up, verification and missing packages",
  description:
    "How to sign up for USPS Informed Delivery, get through identity verification, turn on package emails, and fix the usual reasons packages don’t show up.",
  published: "2026-10-08",
  updated: "2026-10-08",
  readingMinutes: 5,
  category: "Carriers",
};

export default function Content() {
  return (
    <>
      <p>
        Informed Delivery is a free USPS service that shows you what the
        Postal Service is about to deliver to your address: pictures of
        incoming letters and a list of incoming USPS packages, with no
        tracking numbers to type. It’s the most useful of the carrier
        programs for most US households, because USPS delivers to nearly
        every address and also carries parcels that other shippers hand over
        for the last mile. Here’s how to get it working and what to do when a
        package doesn’t appear.
      </p>

      <h2>What you get</h2>
      <ul>
        <li>
          <strong>A Daily Digest email</strong>, Monday to Saturday, usually
          before 9 a.m. It isn’t sent on Sundays, federal holidays or days
          with no mail.
        </li>
        <li>
          <strong>Images of letter-size mail.</strong> These are grayscale
          scans of the address side of envelopes that go through USPS sorting
          machines. Large envelopes and other “flats” generally aren’t
          imaged. The email shows a limited number of images; the online
          dashboard shows the rest.
        </li>
        <li>
          <strong>A package list.</strong> The digest groups USPS packages
          into those expected today and those expected soon. A “Packages
          Awaiting Sender” section lists labels that have been created but
          not yet handed to USPS, and outbound packages you’ve sent appear
          separately.
        </li>
        <li>
          <strong>An online dashboard</strong> at{" "}
          <a href="https://informeddelivery.usps.com/" rel="noopener noreferrer" target="_blank">informeddelivery.usps.com</a>{" "}
          with every package USPS has linked to your address. Package details
          stay there for about 15 days.
        </li>
        <li>
          <strong>Optional per-package emails</strong> for expected delivery,
          day of delivery, delivered, available for pickup and delivery
          exceptions. These are worth switching on; more below.
        </li>
      </ul>
      <p>
        The service is free. USPS’s{" "}
        <a href="https://www.usps.com/manage/informed-delivery.htm" rel="noopener noreferrer" target="_blank">Informed Delivery page</a>{" "}
        and{" "}
        <a href="https://faq.usps.com/s/article/Informed-Delivery-The-Basics" rel="noopener noreferrer" target="_blank">FAQ</a>{" "}
        have the official details.
      </p>

      <h2>What the Daily Digest looks like</h2>
      <p>
        The email’s subject reads something like “Your Daily Digest for Thu,
        5/1 is ready to view”. Near the top, a short summary tells you how
        many mailpieces and inbound packages are on the way. Below that come
        the letter images, then the packages.
      </p>
      <p>
        In the digests we’ve examined, each package shows its tracking
        number, a sender name and, for packages not due today, a line such
        as “Estimated Delivery on: Wednesday, Nov 02”. USPS redesigns the
        email from time to time, so yours may look slightly different. Don’t be surprised if the sender name looks
        cryptic. USPS shows the name of the company that mailed the
        package, which is often a shipping service or a warehouse code
        rather than the shop you bought from. Select a package to see its
        full tracking history on the dashboard.
      </p>

      <h2>Who can sign up</h2>
      <p>
        Informed Delivery is US-only. It covers residential and PO Box
        addresses. Businesses can use it too, but they need a USPS.com
        business account rather than a personal one.
      </p>
      <p>
        <strong>Apartments and condos are the most common snag.</strong>{" "}
        USPS can only offer the service when each unit has its own delivery
        code in its systems, and many multi-unit buildings don’t have one
        yet; USPS describes that coding as a work in progress. An eligible
        ZIP code also doesn’t guarantee that every address in it is eligible.
        The sign-up page checks your exact address first, so that’s the
        quickest way to find out.
      </p>

      <h2>How to sign up</h2>
      <ol>
        <li>
          Go to{" "}
          <a href="https://informeddelivery.usps.com/" rel="noopener noreferrer" target="_blank">informeddelivery.usps.com</a>{" "}
          and enter your address to check eligibility.
        </li>
        <li>
          Sign in to your USPS.com account, or create one. Use your real name
          and the address exactly as your mail is addressed, including any
          apartment or unit number.
        </li>
        <li>
          <strong>Verify your identity online.</strong> USPS uses an online
          identity check, which may ask questions based on your personal
          history or send a passcode to your phone.
        </li>
        <li>
          <strong>If the online check fails</strong>, choose another option:
          ask for a verification code by mail (it arrives at the address
          after several business days) or verify in person at a Post Office
          with photo ID.
        </li>
        <li>
          <strong>Wait for activation.</strong> USPS says notifications
          usually start within about three business days, and occasionally
          take up to seven.
        </li>
      </ol>
      <p>
        After someone signs up, USPS mails a notice to the address. That’s a
        safety feature: if you receive one and nobody in your home signed up,
        contact USPS, because someone may be trying to watch your mail. USPS
        added these notices, along with stronger identity checks, after
        thieves misused the service to see what was arriving at other
        people’s homes.
      </p>

      <h2>Turn on package email notifications</h2>
      <p>
        The Daily Digest alone isn’t enough for packages. It goes out once in
        the morning, so anything scanned afterwards misses it, and USPS’s
        own digest notes that you may have more mail or packages than it
        shows. The per-package emails fill that gap.
      </p>
      <ol>
        <li>Sign in at informeddelivery.usps.com and open Settings.</li>
        <li>Make sure the Daily Digest email is turned on.</li>
        <li>
          Find the package notification section (it has been labeled “Daily
          Package &amp; Traceable Indicia Updates”) and tick Email for each
          update type: expected delivery, day of delivery, delivered,
          available for pickup and delivery exceptions.
        </li>
        <li>Save your changes.</li>
      </ol>
      <p>
        USPS adjusts its settings pages from time to time, so the labels may
        not match exactly. Look for the equivalent email options.
      </p>

      <h2>Why a package isn’t showing up</h2>
      <p>
        If you know a package is coming but Informed Delivery doesn’t list
        it, one of these is usually the reason:
      </p>
      <ul>
        <li>
          <strong>USPS isn’t delivering it.</strong> Only USPS-handled items
          appear. Packages that UPS, FedEx, DHL Express or Amazon’s own
          drivers deliver won’t be there, though parcels another shipper hands
          to USPS for the final delivery can be.
        </li>
        <li>
          <strong>It hasn’t been linked yet.</strong> A package appears once
          USPS has its label data or first scan. If the label exists but the
          sender hasn’t handed it over, it sits under Packages Awaiting
          Sender.
        </li>
        <li>
          <strong>It was scanned after the digest went out.</strong> Check
          the dashboard or the per-package emails instead.
        </li>
        <li>
          <strong>The address on the label is different.</strong> If the
          sender used an old address or left off your unit number, USPS may
          not be able to match the package to your account.
        </li>
        <li>
          <strong>It’s old.</strong> Package details drop off the dashboard
          after roughly 15 days.
        </li>
        <li>
          <strong>Your account changed.</strong> Editing the name, email or
          address on your USPS.com profile, or filing a Change of Address,
          can interrupt Informed Delivery until you verify again. If it went
          quiet after a change, sign in and look for a verification prompt.
        </li>
        <li>
          <strong>You’ve only just signed up.</strong> Give it the three to
          seven business days USPS quotes.
        </li>
      </ul>

      <h2>How to tell a real Informed Delivery email from a fake</h2>
      <p>
        Daily Digest emails currently come from{" "}
        <code>USPSInformeddelivery@email.informeddelivery.usps.com</code>
        , and older ones came from a similar address without the “email.”
        part. USPS package tracking emails come from{" "}
        <code>auto-reply@usps.com</code>. A sender address can be faked,
        though, so also check that links point to a usps.com address before
        you click, and never pay anything or enter card details from an
        email or text about a delivery.
      </p>
      <p>
        USPS says it won’t text or email you about a package unless you
        asked for updates using its tracking number, and that those messages
        won’t contain a link. Our{" "}
        <Link href="/guides/fake-delivery-text-scams">guide to fake delivery texts</Link>{" "}
        covers the common tricks.
      </p>

      <h2>Using Informed Delivery with Package Radar</h2>
      <p>
        Informed Delivery is one of the main sources Package Radar reads. If
        you keep both the Daily Digest and the per-package emails switched
        on and forward them to your Package Radar address, your USPS
        packages appear on the same list as UPS and FedEx deliveries. The{" "}
        <Link href="/setup">setup</Link> shows exactly which senders to
        forward. For the other carriers, see our guides to{" "}
        <Link href="/guides/ups-my-choice">UPS My Choice</Link> and{" "}
        <Link href="/guides/fedex-delivery-manager">FedEx Delivery Manager</Link>
        .
      </p>
    </>
  );
}
