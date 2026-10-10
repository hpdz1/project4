import Link from "next/link";
import type { GuideMeta } from "./types";

export const meta: GuideMeta = {
  slug: "fedex-delivery-manager",
  title: "FedEx Delivery Manager: see FedEx packages headed to your home",
  description:
    "How FedEx Delivery Manager works: residential addresses only, up to three of them, address verification, which alerts to pick and the free vacation hold.",
  published: "2026-10-08",
  updated: "2026-10-08",
  readingMinutes: 5,
  category: "Carriers",
};

export default function Content() {
  return (
    <>
      <p>
        FedEx Delivery Manager is FedEx’s free service for people receiving
        packages at home. After FedEx confirms that you live at an address,
        it alerts you about FedEx packages headed there, without tracking
        numbers, including ones you didn’t order yourself. It also lets you
        hold deliveries while you’re away. This guide covers who can use it,
        how verification works and which settings matter.
      </p>

      <h2>What Delivery Manager does</h2>
      <ul>
        <li>
          <strong>Alerts for packages addressed to you</strong>, covering
          eligible FedEx Express, FedEx Ground and FedEx Home Delivery
          shipments to your registered home address.
        </li>
        <li>
          <strong>A list of active shipments</strong> when you’re signed in
          at fedex.com (choose Delivery Manager in the left-hand menu) or in
          the FedEx Mobile app.
        </li>
        <li>
          <strong>Delivery options</strong> such as a free vacation hold.
          Some other options cost extra; more on that below.
        </li>
      </ul>
      <p>
        The service itself is free. FedEx’s{" "}
        <a href="https://www.fedex.com/en-us/delivery-manager.html" rel="noopener noreferrer" target="_blank">Delivery Manager page</a>{" "}
        and{" "}
        <a href="https://www.fedex.com/en-us/faq/delivery-manager.html" rel="noopener noreferrer" target="_blank">FAQ</a>{" "}
        have the current details.
      </p>

      <h2>Who can use it</h2>
      <ul>
        <li>
          <strong>Residential addresses only.</strong> Business addresses
          can’t be registered.
        </li>
        <li>
          <strong>Up to three addresses</strong> per account.
        </li>
        <li>
          <strong>Your name has to be linked to the address</strong> in the
          records FedEx checks against. You can add up to five other
          spellings of your first name (say, “Bill” as well as “William”) so
          packages addressed to a nickname still match.
        </li>
        <li>
          <strong>Mainly the US.</strong> Canada has a residential version.
          In some other countries, Delivery Manager works differently and
          only covers shipments where the sender has switched it on.
        </li>
      </ul>

      <h2>Signing up and verifying your address</h2>
      <p>
        FedEx explains the process on its{" "}
        <a href="https://www.fedex.com/en-us/delivery-manager/registering.html" rel="noopener noreferrer" target="_blank">registration page</a>
        . In outline:
      </p>
      <ol>
        <li>Create a fedex.com account, or sign in to the one you have.</li>
        <li>
          Choose to sign up for Delivery Manager and enter your name and
          home address.
        </li>
        <li>
          <strong>Verify the address.</strong> FedEx may confirm it
          automatically through an identity-checking service, or send a
          one-time code to your mobile phone that expires within minutes.
          Some sign-ups are asked security questions instead; if those fail,
          you may have to wait before trying again.
        </li>
        <li>
          <strong>If FedEx can’t verify you online</strong>, it can mail a
          postcard with a 6-digit PIN to the address. Enter the PIN when it
          arrives to finish registration.
        </li>
        <li>Choose your notification settings.</li>
      </ol>
      <p>
        Two things trip people up later. Editing an address, or adding a new
        one, means verifying it again. And registration doesn’t last
        forever: FedEx says it’s valid for a year and then needs renewing,
        so if your alerts go quiet after about a year, check that first.
      </p>

      <h2>Which alerts to turn on</h2>
      <p>
        In your Delivery Manager settings you choose when FedEx notifies you
        about shipments addressed to you. The wording has changed over time,
        but the options have included:
      </p>
      <ul>
        <li>
          <strong>FedEx has a package addressed to me</strong>: the earliest
          warning, sent when a shipment headed to you is handed to FedEx.
        </li>
        <li>
          <strong>The day before delivery</strong> and{" "}
          <strong>the day of delivery</strong>.
        </li>
        <li>
          <strong>A delivery exception has occurred</strong>: a delay, a
          failed attempt or an address problem.
        </li>
        <li>
          <strong>A package for me is ready to be picked up</strong>.
        </li>
        <li>
          <strong>A delivery has been made to my address</strong>.
        </li>
      </ul>
      <p>
        Pick <strong>email</strong> as the channel if you want to forward the
        alerts or keep a record. Delivery Manager emails come from{" "}
        <code translate="no">TrackingUpdates@fedex.com</code> with the display name “FedEx
        Delivery Manager”, and delivery emails can include a photo of where
        the package was left. As always, a sender name can be faked, so if a
        message asks for money, go to fedex.com yourself instead of tapping a
        link.
      </p>

      <h2>What the alerts tell you</h2>
      <p>
        Delivery Manager emails are short, but they carry more than a status.
        Real FedEx alerts we’ve examined include:
      </p>
      <ul>
        <li>
          <strong>The tracking number</strong>, usually right in the subject
          line, for example “FedEx Shipment [number]: Your package is now out
          for delivery today”.
        </li>
        <li>
          <strong>Who it’s from</strong>, as in “Your package from [shipper]
          is now out for delivery today”. The shipper is often a warehouse or
          distribution center rather than the shop you bought from.
        </li>
        <li>
          <strong>The scheduled delivery date</strong>, which may read
          “Pending” until FedEx sets one, and the service, such as FedEx Home
          Delivery or FedEx Ground.
        </li>
        <li>
          <strong>A reference field.</strong> For Amazon orders that FedEx
          delivers, this often holds the Amazon order number, which makes it
          easy to match the box to the order.
        </li>
        <li>
          <strong>On delivery</strong>, a “Your shipment was delivered”
          message with the tracking number and, sometimes, a photo.
        </li>
      </ul>

      <h2>Vacation hold and other delivery options</h2>
      <p>
        The{" "}
        <a href="https://www.fedex.com/en-us/delivery-manager/vacation-hold.html" rel="noopener noreferrer" target="_blank">vacation hold</a>{" "}
        is free and holds eligible packages for up to 14 days while you’re
        away, so they aren’t left on an empty doorstep. It’s a good reason
        to sign up even if you rarely get FedEx packages.
      </p>
      <p>
        Other requests, such as scheduling delivery for a specific date or
        time, are premium options with a fee that depends on your location.
        FedEx also notes that delivery preferences may not apply to every
        shipment, so for anything valuable, check the package’s own tracking
        page to confirm your request took effect.
      </p>

      <h2>Common problems</h2>
      <ul>
        <li>
          <strong>“We couldn’t verify your address.”</strong> Use your name as
          it appears on official records for that address, double-check the
          unit number, and add nickname spellings. If you’ve recently moved,
          the records may lag; the postcard PIN is the fallback.
        </li>
        <li>
          <strong>You’ve moved.</strong> Add the new address and verify it
          before relying on alerts there; editing an existing address also
          triggers a new verification.
        </li>
        <li>
          <strong>A package didn’t show up.</strong> Only eligible FedEx
          shipments to your registered addresses are covered, and FedEx has
          to match the name on the label to your account (see the quick
          answers below).
        </li>
        <li>
          <strong>Alerts stopped.</strong> Check whether your registration
          needs renewing or an edited address needs verifying again.
        </li>
      </ul>

      <h2>Quick answers</h2>
      <h3>Is this the same as tracking a package on fedex.com?</h3>
      <p>
        No. Ordinary tracking needs a tracking number and follows one
        package. Delivery Manager finds FedEx packages addressed to you at
        your verified home and tells you about them before you have a
        number.
      </p>
      <h3>Will it show packages for everyone in my home?</h3>
      <p>
        Not necessarily. FedEx matches packages to your name as well as your
        address, so a package addressed to a housemate under a different
        name may not appear on your account.
      </p>
      <h3>Can I use it for my office or a PO box?</h3>
      <p>
        No. Delivery Manager is for residential addresses only.
      </p>

      <h2>Adding FedEx to Package Radar</h2>
      <p>
        With email alerts switched on, Delivery Manager is one of the feeds
        Package Radar reads. Forward those FedEx emails to your Package Radar
        address and FedEx packages appear alongside your USPS and UPS ones.
        The <Link href="/setup">setup</Link> shows how. If you haven’t set up
        the other carriers yet, start with our guides to{" "}
        <Link href="/guides/usps-informed-delivery">USPS Informed Delivery</Link>{" "}
        and <Link href="/guides/ups-my-choice">UPS My Choice</Link>.
      </p>
    </>
  );
}
