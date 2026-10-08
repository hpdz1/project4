import Link from "next/link";
import type { GuideMeta } from "./types";

export const meta: GuideMeta = {
  slug: "how-to-see-every-package-coming-to-your-address",
  title: "How to see every package coming to your address",
  description:
    "USPS, UPS and FedEx will show you the packages headed to your home for free once you verify your address. What each shows, the gaps, and a 15-minute plan.",
  published: "2026-10-08",
  updated: "2026-10-08",
  readingMinutes: 6,
  category: "Getting started",
};

export default function Content() {
  return (
    <>
      <p>
        You can’t type an address into a website and see every package headed
        there, and you shouldn’t trust any site that says you can. What you
        can do is ask each carrier to tell <em>you</em> about packages coming
        to <em>your own</em> home. USPS, UPS and FedEx all run free programs
        that do exactly that once you prove you live at the address. This
        guide explains what each program shows, what none of them can see,
        and how to set them all up in about 15 minutes of actual work.
      </p>

      <h2>Why there’s no “look up my address” website</h2>
      <p>
        Carriers know which packages are going to your address, but they only
        share that list with a verified resident. If anyone could look up any
        home’s deliveries, strangers could watch for expensive parcels, learn
        when a house is empty, or follow someone who has moved. That’s why
        every carrier program below checks your identity, and some mail a
        code to the address before they switch on.
      </p>
      <p>
        It’s also why messages that ask you to “confirm your address to see
        your package” deserve suspicion: that’s the opening line of a very
        common phishing scam. Our guide to{" "}
        <Link href="/guides/fake-delivery-text-scams">fake delivery texts</Link>{" "}
        shows what those look like.
      </p>

      <h2>The programs at a glance</h2>
      <p>
        Three programs are <strong>address-based</strong>: once you’re
        verified, they list packages headed to your home even if you never
        saw a tracking number, including ones someone else ordered for you.
        The others only know about packages tied to your own account, email
        or phone number.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Program</th>
              <th scope="col">What it covers</th>
              <th scope="col">How it finds your packages</th>
              <th scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>USPS Informed Delivery</td>
              <td>USPS packages, plus scans of letter-size mail</td>
              <td>Your verified address</td>
              <td>Free</td>
            </tr>
            <tr>
              <td>UPS My Choice</td>
              <td>UPS packages</td>
              <td>Your verified name and address</td>
              <td>Free; optional paid Premium</td>
            </tr>
            <tr>
              <td>FedEx Delivery Manager</td>
              <td>FedEx Express, Ground and Home Delivery packages</td>
              <td>Your verified home address (up to three)</td>
              <td>Free; some delivery changes cost extra</td>
            </tr>
            <tr>
              <td>Amazon order emails</td>
              <td>Orders placed on your own Amazon account</td>
              <td>Your Amazon account</td>
              <td>Free with an account</td>
            </tr>
            <tr>
              <td>DHL On Demand Delivery</td>
              <td>DHL Express shipments</td>
              <td>One shipment at a time, matched by your email or mobile number</td>
              <td>Free for recipients</td>
            </tr>
            <tr>
              <td>OnTrac NotifyMe</td>
              <td>One OnTrac package at a time</td>
              <td>The package’s tracking number</td>
              <td>Free</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>USPS Informed Delivery</h3>
      <p>
        Informed Delivery sends a Daily Digest email most mornings, Monday to
        Saturday, with grayscale images of the letter-size mail due that day
        and a list of USPS packages expected today or soon. A dashboard on
        usps.com shows more, and you can switch on separate emails for each
        package (expected delivery, out for delivery, delivered, problems).
        It covers house, apartment and PO Box addresses, although some
        apartment buildings can’t sign up yet. Our{" "}
        <Link href="/guides/usps-informed-delivery">Informed Delivery guide</Link>{" "}
        walks through sign-up and the most common problems.
      </p>

      <h3>UPS My Choice</h3>
      <p>
        The free UPS My Choice membership lists incoming UPS packages for
        your address without tracking numbers, shows an estimated delivery
        window, and sends alerts by email, text or app. Premium is optional
        and mostly about changing deliveries. Some members have to wait for
        an activation code that UPS mails to the address. Details are in our{" "}
        <Link href="/guides/ups-my-choice">UPS My Choice guide</Link>.
      </p>

      <h3>FedEx Delivery Manager</h3>
      <p>
        Delivery Manager alerts you about FedEx packages addressed to your
        home, including a notice when FedEx first learns a package is on its
        way to you. It only works for residential addresses, up to three of
        them, and FedEx checks that your name is linked to each one. See the{" "}
        <Link href="/guides/fedex-delivery-manager">FedEx Delivery Manager guide</Link>.
      </p>

      <h3>Amazon</h3>
      <p>
        Amazon isn’t address-based. Your Orders page and Amazon’s shipping
        emails only cover orders placed on <em>your</em> account, whichever
        carrier delivers them. When Amazon hands a parcel to USPS, UPS or
        FedEx, it can also show up in that carrier’s program. When Amazon’s
        own drivers deliver an order that someone else placed, only the buyer
        hears about it.
      </p>

      <h3>DHL Express On Demand Delivery</h3>
      <p>
        DHL’s free{" "}
        <a href="https://delivery.dhl.com/" rel="noopener noreferrer" target="_blank">On Demand Delivery</a>{" "}
        service sends alerts about DHL Express shipments and lets you
        reschedule or redirect them. It works shipment by shipment and
        matches best when the sender has your email or mobile number, so it
        won’t list everything coming to your address. In the US, DHL’s
        separate eCommerce service generally hands parcels to USPS for the
        final delivery and they carry a USPS tracking number (see{" "}
        <a href="https://www.dhl.com/us-en/home/customer-service/ecommerce-tracking-faq.html" rel="noopener noreferrer" target="_blank">DHL’s eCommerce tracking FAQ</a>
        ), so look for those in Informed Delivery.
      </p>

      <h3>OnTrac (formerly LaserShip)</h3>
      <p>
        OnTrac has no consumer account that lists packages coming to you. If
        you have an OnTrac tracking number, its{" "}
        <a href="https://www.ontrac.com/tracking/" rel="noopener noreferrer" target="_blank">tracking page</a>{" "}
        offers NotifyMe text alerts for that one package.
      </p>

      <h2>The blind spots</h2>
      <p>
        Even with every program switched on, some packages will surprise you.
        Knowing the gaps keeps you from trusting an empty list too much.
      </p>
      <ul>
        <li>
          <strong>Amazon packages someone else ordered.</strong> A gift or a
          housemate’s order delivered by Amazon’s own drivers only appears in
          the buyer’s Amazon account. Ask them to share the tracking link.
        </li>
        <li>
          <strong>Regional and local couriers.</strong> Smaller delivery
          companies, same-day services and store couriers have no
          address-based program. You’ll only hear about those packages from
          the shop’s own emails.
        </li>
        <li>
          <strong>Packages that haven’t been scanned yet.</strong> A carrier
          usually lists a package once it has the label data or a first scan,
          so very new shipments may not appear for a while.
        </li>
        <li>
          <strong>Names that don’t match.</strong> UPS and FedEx match
          packages to your name as well as your address. A package addressed
          to a housemate under a different name may not show up for you.
        </li>
        <li>
          <strong>Incomplete digests.</strong> USPS itself warns that you may
          have more mail or packages than the Daily Digest shows, and anything
          scanned after the digest goes out won’t be in it.
        </li>
      </ul>

      <h2>A 15-minute setup plan</h2>
      <p>
        The online part takes about 15 minutes. Mailed activation codes can
        stretch the whole process over a week or two, so start today and
        finish each step as the codes arrive.
      </p>
      <ol>
        <li>
          <strong>Check what covers your home (1 minute).</strong> Enter your
          address on our <Link href="/">coverage checker</Link> to see which
          programs apply. Your street address stays in your browser.
        </li>
        <li>
          <strong>Start Informed Delivery (5 minutes).</strong> Go to{" "}
          <a href="https://informeddelivery.usps.com/" rel="noopener noreferrer" target="_blank">informeddelivery.usps.com</a>
          , check that your address is eligible, create or sign in to a
          USPS.com account and complete the identity check. If the online
          check fails, ask for a code by mail.
        </li>
        <li>
          <strong>Join UPS My Choice (3 minutes).</strong> Sign up on{" "}
          <a href="https://www.ups.com/us/en/track/ups-my-choice" rel="noopener noreferrer" target="_blank">UPS’s My Choice page</a>{" "}
          with the name your packages are usually addressed to. The free
          membership is enough.
        </li>
        <li>
          <strong>Join FedEx Delivery Manager (3 minutes).</strong> Register
          on{" "}
          <a href="https://www.fedex.com/en-us/delivery-manager.html" rel="noopener noreferrer" target="_blank">fedex.com</a>{" "}
          and verify your address with a texted code, or wait for a postcard
          with a PIN.
        </li>
        <li>
          <strong>Turn on email alerts everywhere (3 minutes).</strong>{" "}
          In each program’s settings, choose email for the day-before,
          day-of, delivered and problem alerts. Make sure Amazon shipping
          emails aren’t switched off on each household account.
        </li>
      </ol>
      <p>
        Expect Informed Delivery to start sending notifications within about
        three business days, occasionally up to seven. UPS activation letters
        usually take one to two weeks to arrive.
      </p>

      <h2>Putting the alerts in one place</h2>
      <p>
        Once everything is on, your answer to “is anything coming?” is spread
        across three or four inboxes, apps and dashboards. You can check each
        one, and plenty of people do. If you’d rather look in one place,
        that’s what Package Radar is for: you add one email filter that
        forwards those carriers’ alerts to a personal Package Radar address,
        and we turn them into a single list of what’s arriving today, what’s
        on the way and what was just delivered.
      </p>
      <p>
        We can only show what your carriers email you about. We never ask for
        carrier passwords or tracking numbers, and if you skip a program its
        packages won’t appear. When you’re ready, Package Radar’s{" "}
        <Link href="/setup">setup</Link> walks you through it step by step.
      </p>

      <h2>Outside the US</h2>
      <p>
        UPS My Choice is offered in many countries, though UPS says
        availability varies by location, and FedEx Delivery Manager has a
        residential version in Canada. Several national postal services run
        their own address-matched programs, such as Canada Post’s{" "}
        <a href="https://www.canadapost-postescanada.ca/cpc/en/personal/manage-mail/automatic-tracking.page" rel="noopener noreferrer" target="_blank">automatic tracking</a>{" "}
        and DHL’s{" "}
        <a href="https://www.dhl.de/en/privatkunden/pakete-empfangen/sendungen-verfolgen/paketankuendigung.html" rel="noopener noreferrer" target="_blank">parcel announcement</a>{" "}
        in Germany. Others match parcels to the email or phone number you
        give the shop rather than your address. Check your national carrier’s
        website for what it offers.
      </p>
    </>
  );
}
