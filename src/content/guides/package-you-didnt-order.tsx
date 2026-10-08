import Link from "next/link";
import type { GuideMeta } from "./types";

export const meta: GuideMeta = {
  slug: "package-you-didnt-order",
  title: "Got a package you didn’t order? Brushing scams and other explanations",
  description:
    "Why unordered packages show up, what the FTC says to do about brushing scams (yes, you can keep it), and how to tell a scam from a gift or a housemate’s order.",
  published: "2026-10-08",
  updated: "2026-10-08",
  readingMinutes: 5,
  category: "Safety",
};

export default function Content() {
  return (
    <>
      <p>
        A box arrives with your name on it, but you didn’t order it. Maybe
        it’s a phone case or a cheap gadget from a seller you’ve never heard
        of. Often there’s an innocent explanation, and
        sometimes it’s a scam called <strong>brushing</strong>. Either way,
        it’s rarely an emergency. Here’s how to work out which it is and
        what to do, based on guidance from the Federal Trade Commission.
      </p>

      <h2>First, check the label</h2>
      <p>
        Look at exactly who the package is addressed to before anything else.
      </p>
      <ul>
        <li>
          <strong>Someone else’s name or address:</strong> it’s probably a
          misdelivery or meant for a previous resident. It isn’t yours to
          keep. Take it to the right neighbor if it’s close by, or contact
          the carrier that delivered it so they can collect it.
        </li>
        <li>
          <strong>Your name and address:</strong> read on. The rest of this
          guide is about packages addressed to you that nobody in your home
          seems to have ordered.
        </li>
      </ul>

      <h2>Innocent explanations come first</h2>
      <p>
        Before assuming a scam, rule out the ordinary reasons a package
        arrives unannounced:
      </p>
      <ul>
        <li>
          <strong>A gift.</strong> Online gifts often arrive with no note,
          or with the note in a separate box, so the sender isn’t obvious.
        </li>
        <li>
          <strong>Someone else in your home ordered it.</strong> Partners,
          roommates and teenagers use their own shopping accounts. Ask
          around, and check whether a shared account has an order you didn’t
          know about.
        </li>
        <li>
          <strong>A subscription or auto-ship order</strong> you set up long
          ago and forgot.
        </li>
        <li>
          <strong>A replacement or a split shipment</strong> for something
          you did order, or a warranty part.
        </li>
        <li>
          <strong>A free sample or promotional item</strong> from a company
          you’ve bought from before.
        </li>
      </ul>
      <p>
        To check, ask the people you live with, look at the order history on
        each household shopping account, and search your email for the
        sender’s name or the tracking number. Our guide to{" "}
        <Link href="/guides/track-a-package-without-a-tracking-number">finding a package without a tracking number</Link>{" "}
        has inbox search tips that work here too.
      </p>

      <h2>What brushing is</h2>
      <p>
        In a brushing scam, an online seller ships cheap items to real
        people who never ordered them. The point isn’t the item: it’s the
        delivery record. A delivered order lets the seller post glowing
        “verified” reviews in your name, or under an account set up with your
        details, which pushes their products up the rankings.
      </p>
      <p>
        The FTC has warned about this more than once, including in a{" "}
        <a href="https://consumer.ftc.gov/consumer-alerts/2025/01/got-package-you-didnt-order-its-probably-scam" rel="noopener noreferrer" target="_blank">January 2025 consumer alert about unordered packages</a>{" "}
        and an{" "}
        <a href="https://consumer.ftc.gov/consumer-alerts/2026/08/unexpected-package-you-got-could-be-brushing-scam" rel="noopener noreferrer" target="_blank">August 2026 alert about brushing</a>
        . The uncomfortable part is what it says about your
        data: whoever sent the package had your name and address, and
        possibly more, such as an email address or an old account login.
      </p>

      <h2>Signs that point to brushing</h2>
      <p>
        None of these proves brushing on its own, but together they make a
        familiar pattern:
      </p>
      <ul>
        <li>The item is cheap and not something anyone in your home would buy.</li>
        <li>There’s no gift note, and nobody you’ve asked recognizes it.</li>
        <li>
          The sender is an online marketplace seller you’ve never bought
          from, and the return address is missing or is a warehouse.
        </li>
        <li>More unexplained packages from the same kind of seller follow.</li>
      </ul>

      <h2>The QR-code twist</h2>
      <p>
        A newer variation puts a QR code in the box or on the packing slip,
        with a note inviting you to scan it to find out who sent the gift or
        how to return it. The FTC warns that scanning it can take you to a
        phishing site that asks for personal or financial information. The
        safe move is simple: don’t scan it.
      </p>

      <h2>What the FTC says to do</h2>
      <ol>
        <li>
          <strong>You can keep it.</strong> The FTC says you can keep
          merchandise you didn’t order, and you don’t have to pay for it.
        </li>
        <li>
          <strong>Don’t pay anything</strong>, even if a bill or a message
          later demands payment for the item.
        </li>
        <li>
          <strong>Don’t scan QR codes or follow instructions</strong> that
          came with the package, and don’t contact the sender.
        </li>
        <li>
          <strong>Secure your accounts.</strong> Change the passwords on your
          online shopping accounts, especially if you reuse passwords, and
          turn on two-step verification.
        </li>
        <li>
          <strong>Tell the marketplace.</strong> If the package came from a
          seller on a site like Amazon, report it to that site so it can
          investigate and remove fake reviews.
        </li>
        <li>
          <strong>Watch your statements.</strong> Check your bank and card
          statements and your shopping accounts for activity you don’t
          recognize.
        </li>
        <li>
          <strong>Report it</strong> to the FTC at{" "}
          <a href="https://reportfraud.ftc.gov/" rel="noopener noreferrer" target="_blank">ReportFraud.ftc.gov</a>
          . If it came through the US mail, you can also tell the{" "}
          <a href="https://www.uspis.gov/" rel="noopener noreferrer" target="_blank">US Postal Inspection Service</a>
          .
        </li>
      </ol>

      <h2>Is it dangerous?</h2>
      <p>
        The package itself usually isn’t. Brushing is mainly a warning that
        your personal details are circulating. The real risks come after: a
        phishing message that seems to know who you are, an attempt to get
        into one of your accounts, or a fake “delivery problem” text. Taking
        the account steps above deals with most of that.
      </p>
      <p>
        Treat it differently if you’re <strong>charged</strong> for
        something you didn’t order. That isn’t brushing; it may mean someone
        is using your card or account. Contact your card issuer and the
        retailer straight away.
      </p>

      <h2>If the packages keep coming</h2>
      <p>
        Repeat deliveries usually mean a seller is still using your details.
        Report each one to the marketplace it came from, and ask whether any
        account there has been opened or reviews posted in your name. Check
        that the saved addresses and payment methods on your own shopping
        accounts haven’t changed, and keep a short log of what arrived and
        when. If you file a report at ReportFraud.ftc.gov, that log makes it
        quicker and more useful.
      </p>

      <h2>How address programs reveal surprise packages early</h2>
      <p>
        The carriers’ free address programs, USPS Informed Delivery, UPS My
        Choice and FedEx Delivery Manager, alert you about packages addressed
        to your home whether or not you ordered them. So an unexpected
        package often shows up in an alert days before it reaches your door,
        usually with a shipper name attached.
      </p>
      <p>
        Shipper names can be cryptic. USPS often shows the mailer’s name or
        a warehouse code rather than the shop, so “Arriving soon” from a name
        you don’t recognize isn’t automatically suspicious. Still, an early
        alert gives you time to ask around: is it a birthday present, a
        housemate’s order, or something nobody expected?
      </p>
      <p>
        One blind spot: Amazon orders delivered by Amazon’s own drivers only
        appear in the buyer’s Amazon account, so a gift sent that way can
        still arrive unannounced.
      </p>
      <p>
        If you use Package Radar, those carrier alerts land on one list, and
        you can hide anything that turns out not to be yours. Our guide to{" "}
        <Link href="/guides/how-to-see-every-package-coming-to-your-address">seeing every package coming to your address</Link>{" "}
        explains how to set up the carrier programs, with or without us.
      </p>
    </>
  );
}
