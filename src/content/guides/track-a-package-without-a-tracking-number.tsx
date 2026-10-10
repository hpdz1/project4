import Link from "next/link";
import type { GuideMeta } from "./types";

export const meta: GuideMeta = {
  slug: "track-a-package-without-a-tracking-number",
  title: "Can you track a package without a tracking number?",
  description:
    "The honest answer: no one can look up packages by address. The options that do work, from carrier programs to reference numbers, and the sites to avoid.",
  published: "2026-10-08",
  updated: "2026-10-10",
  readingMinutes: 5,
  category: "Getting started",
};

export default function Content() {
  return (
    <>
      <p>
        Short answer: not directly. Carriers file every shipment under its
        tracking number, and none of them will search for a package by your
        name or street address on request. But a missing number rarely leaves
        you stuck. There are five realistic ways to find out where a package
        is, and one popular shortcut you should avoid.
      </p>

      <h2>Why you can’t look a package up by address</h2>
      <p>
        If a carrier let anyone type in an address and see what’s being
        delivered there, it would be handing porch thieves and stalkers a
        schedule. So carriers only show address-wide information to a person
        who has proved they live at the address, through the free programs
        described below.
      </p>
      <p>
        Phone agents and counter staff generally work the same way. USPS’s
        own{" "}
        <a href="https://faq.usps.com/s/article/How-to-find-your-tracking-number" rel="noopener noreferrer" target="_blank">tracking-number FAQ</a>{" "}
        says a lost tracking number can’t be recovered, and that Post Office
        staff can’t look one up for you either. UPS and FedEx are similar:
        their tracking tools need either a tracking number or a reference
        number that the shipper put on the label.
      </p>

      <h2>Option 1: Turn on your carriers’ address programs</h2>
      <p>
        This is the closest thing to tracking by address, and it’s
        legitimate because you verify yourself first.{" "}
        <Link href="/guides/usps-informed-delivery">USPS Informed Delivery</Link>
        ,{" "}
        <Link href="/guides/ups-my-choice">UPS My Choice</Link> and{" "}
        <Link href="/guides/fedex-delivery-manager">FedEx Delivery Manager</Link>{" "}
        each list that carrier’s packages headed to your home, with no
        tracking number needed, including packages you didn’t order.
      </p>
      <p>
        The catch is timing. Sign-up takes a few minutes online, but some
        programs mail a code to your address before they switch on, which can
        take days. So this is the best fix for <em>future</em> packages; for a
        package that’s already late, work through the options below at the
        same time. Our guide to{" "}
        <Link href="/guides/how-to-see-every-package-coming-to-your-address">seeing every package coming to your address</Link>{" "}
        covers all the programs and their gaps.
      </p>

      <h2>Option 2: Check the order page where you bought it</h2>
      <p>
        If you bought the item yourself, the shop almost always has the
        tracking details, even if you never opened the shipping email.
      </p>
      <ul>
        <li>
          <strong>Amazon:</strong> open{" "}
          <a href="https://www.amazon.com/gp/css/order-history" rel="noopener noreferrer" target="_blank">Your Orders</a>{" "}
          and choose the order. Amazon tracks by order rather than by
          carrier number, and its shipping emails usually don’t show the
          carrier’s tracking number at all. Older orders may be archived, so
          search or filter by date if you can’t see one. Orders on a
          different household member’s account won’t appear in yours.
        </li>
        <li>
          <strong>Walmart:</strong> go to Account, then Purchase history, then
          Track shipment (see{" "}
          <a href="https://www.walmart.com/help/article/track-your-order/143cf6e1d8cb48e6a1ed840409881235" rel="noopener noreferrer" target="_blank">Walmart’s help page</a>
          ).
        </li>
        <li>
          <strong>Target:</strong> go to Account, then Purchase History.
          Target says tracking can take up to 24 hours to appear after an
          order ships (see{" "}
          <a href="https://www.target.com/help/articles/orders-purchases/track-order" rel="noopener noreferrer" target="_blank">Target’s help page</a>
          ).
        </li>
        <li>
          <strong>Smaller shops:</strong> sign in to your account on their
          site, or find the order confirmation email and look for a “track
          your order” link.
        </li>
      </ul>

      <h2>Option 3: Search your email and texts</h2>
      <p>
        Shipping confirmations are easy to miss because they often land in a
        Promotions or Updates tab, or in spam. Search your whole mailbox,
        including spam, for words that appear in nearly every shipping
        notice:
      </p>
      <ul>
        <li>“tracking number”, “tracking ID” or “waybill”</li>
        <li>“has shipped”, “on its way”, “out for delivery”</li>
        <li>the shop’s name, or a carrier name such as UPS, FedEx or USPS</li>
        <li>
          <code translate="no">1Z</code>, which starts most UPS tracking
          numbers
        </li>
      </ul>
      <p>
        In Gmail you can search several carriers at once, for example{" "}
        <code translate="no">from:(ups.com OR fedex.com OR usps.com)</code>.
        The word OR must be in capitals. If your shops and carriers write to
        you in another language, search for their words for “parcel” and
        “tracking” too. Don’t forget text messages: many shops send shipping
        updates by SMS if you gave a phone number at checkout.
      </p>

      <h2>Option 4: Ask the sender</h2>
      <p>
        Whoever paid for the shipping usually has the tracking number on
        their receipt or in their account. For a gift, ask the person who sent it;
        they can usually forward the shipping email or share a tracking link.
        For a purchase, a shop’s customer service team can resend the
        shipping confirmation. For documents from an employer, bank or
        government office, the sending department can usually tell you how
        and when it went out.
      </p>
      <p>
        The sender is also the right person to chase a package that seems
        lost, because they are the carrier’s customer. More on that in our{" "}
        <Link href="/guides/package-says-delivered-but-not-here">delivered-but-not-here checklist</Link>
        .
      </p>

      <h2>Option 5: Track by reference number (UPS and FedEx)</h2>
      <p>
        UPS and FedEx both let you search for a shipment by a{" "}
        <strong>reference number</strong> instead of a tracking number. A
        reference is something the shipper typed onto the label, such as a
        purchase order, invoice or order number. Look for a “track by
        reference” option on the carrier’s tracking page.
      </p>
      <p>
        This only works if the shipper actually entered a reference, and you
        usually have to add more details to narrow the search, such as the
        destination country and ZIP or postal code, and the approximate ship
        date. The
        exact fields change from time to time, so follow what the carrier’s
        site asks for. A reference search won’t work with just your name or
        address.
      </p>

      <h2>What to avoid: “track by address” websites</h2>
      <p>
        Search for “track package by address” and you’ll find pages that
        claim it can be done, sometimes with invented details such as
        carriers using GPS to find parcels by address. Many are
        auto-generated pages on unrelated websites with no working tool at
        all. At best they waste your time; at worst they ask for personal
        details.
      </p>
      <p>
        The same idea powers a very common scam. Texts that say “we couldn’t
        deliver your package, confirm your address here” lead to lookalike
        carrier sites that collect your address, date of birth and card
        details for a small “redelivery fee”. A real carrier already has your
        address and won’t ask you to pay through a text link. Our{" "}
        <Link href="/guides/fake-delivery-text-scams">guide to fake delivery texts</Link>{" "}
        shows the red flags and where to report them.
      </p>

      <h2>A quick decision guide</h2>
      <ul>
        <li>
          <strong>You bought it:</strong> start with the shop’s order page
          (Option 2), then your inbox (Option 3).
        </li>
        <li>
          <strong>Someone sent it to you:</strong> ask them (Option 4). If
          you have the carrier’s address program, check its dashboard too.
        </li>
        <li>
          <strong>You only have an order or invoice number:</strong> try a
          UPS or FedEx reference search (Option 5).
        </li>
        <li>
          <strong>You want this to be easier next time:</strong> turn on the
          address programs (Option 1) so the carriers tell you about packages
          before you have to go looking.
        </li>
      </ul>

      <h2>Outside the US?</h2>
      <p>
        The same rule applies everywhere: no carrier will look up parcels by
        your name or address on request, and every option above still
        works. Two things differ abroad. Many carriers in Europe, Australia
        and New Zealand recognise your parcels by the email address or phone
        number you gave the shop, so their apps can list parcels with no
        tracking number once you sign up with those same details. And orders
        from cross-border marketplaces often change tracking number when your
        national post or a local courier takes over, so the shop’s order page
        is the best place to find the current one.
      </p>
      <p>
        Our regional guides list what to switch on in each country:{" "}
        <Link href="/guides/parcel-notifications-europe">Europe</Link>,{" "}
        <Link href="/guides/parcel-notifications-asia-pacific">Asia-Pacific</Link>{" "}
        and{" "}
        <Link href="/guides/parcel-notifications-americas-middle-east-africa">Canada, Latin America, the Middle East and Africa</Link>
        .
      </p>

      <h2>Where Package Radar fits</h2>
      <p>
        Package Radar doesn’t track by address either; nobody legitimate can.
        It collects the alerts that your own carrier programs and shops email
        you, and shows them on one page, so a package you didn’t know about
        still turns up on your list without a tracking number. If that sounds
        useful, the <Link href="/setup">setup</Link> takes about 15 minutes.
      </p>
    </>
  );
}
