import Link from "next/link";
import { formatIsoDate } from "@/components/site/guides";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  SITE_NAME,
  pageMetadata,
} from "@/lib/site";

export const metadata = pageMetadata({
  title: "Privacy policy",
  description:
    "What Package Radar collects, what stays in your browser, how advertising cookies work, how long we keep data and how to delete everything with one button.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <PageHeader
        title="Privacy policy"
        description={`${SITE_NAME} is built to know as little about you as possible. This page explains exactly what we collect, why, and how to delete it.`}
      >
        <p className="text-sm text-muted">
          Effective{" "}
          <time dateTime={LEGAL_EFFECTIVE_DATE}>
            {formatIsoDate(LEGAL_EFFECTIVE_DATE)}
          </time>
        </p>
      </PageHeader>

      <div className="article">
        <h2 id="short-version">The short version</h2>
        <ul>
          <li>
            Your street address stays in your browser. Of your address, our
            servers only receive your country, ZIP or postcode and state or
            province.
          </li>
          <li>
            From the carrier emails you forward to us, we keep the shipment
            details (carrier, tracking number, shipper, status and dates). We
            do not keep the full email.
          </li>
          <li>
            We never ask for your carrier passwords, never log in to carrier
            websites on your behalf and never sell your data.
          </li>
          <li>
            Some pages may show ads from Google. Google uses cookies for that,
            and you can opt out of personalized ads.
          </li>
          <li>
            The <strong>Delete my data</strong> button in your dashboard
            settings deletes everything we hold about you, immediately.
          </li>
        </ul>

        <h2 id="what-we-collect">What we collect</h2>

        <h3>When you check your address</h3>
        <p>
          When you type your address on the home page, it is read by code
          running in your own browser to work out your country, ZIP or postcode
          and state or province, so we can show which carrier programs cover
          you. The street part of the address is not sent to our servers.
        </p>

        <h3>When you set up your radar</h3>
        <p>When you create a radar, we store:</p>
        <ul>
          <li>your country, ZIP or postcode and state or province;</li>
          <li>
            your time zone, so &ldquo;arriving today&rdquo; means today where
            you live;
          </li>
          <li>
            a random account ID and your personal forwarding address (for
            example <code>r-k3j9x2m4q8w1@…</code>);
          </li>
          <li>
            a scrambled (hashed) copy of your secret sign-in key. We never
            store the key itself, so we can&apos;t see or recover it;
          </li>
          <li>
            which carrier programs you marked as done or skipped during setup;
          </li>
          <li>when your account was created and last changed.</li>
        </ul>
        <p>
          We don&apos;t ask for your name, your street address, your phone
          number or your email password. We don&apos;t ask for your email
          address to sign up either.
        </p>

        <h3>From the carrier emails you forward</h3>
        <p>
          When a carrier email reaches your forwarding address, our software
          reads it automatically and extracts the shipment details:
        </p>
        <ul>
          <li>the carrier (for example USPS, UPS or FedEx);</li>
          <li>the tracking number, or a retailer order number if there is no tracking number;</li>
          <li>the shipper&apos;s name and, when the email includes it, a short item description;</li>
          <li>the delivery status (for example &ldquo;out for delivery&rdquo;);</li>
          <li>the expected delivery date and time window, and when it was delivered.</li>
        </ul>
        <p>
          We also keep a short log of the emails we processed: when each one
          arrived, the sender&apos;s domain (such as <code>ups.com</code>), what
          kind of carrier email it was and how many updates it contained. This
          lets your dashboard tell you when a carrier feed has gone quiet.
        </p>
        <p>
          <strong>We do not keep the full email body.</strong> Each email is
          processed when it arrives and then discarded; only the fields above
          are saved. The email service that receives mail for us handles each
          message in transit and may keep it briefly under its own policies.
        </p>

        <h3>Forwarding confirmation codes</h3>
        <p>
          When you set up forwarding, Gmail and other email providers send a
          confirmation code to your Package Radar address to check that you
          own it. We show that code to you on the setup screen for 48 hours so
          you can finish the setup. We keep only the most recent few codes, and
          they are deleted together with the rest of your data.
        </p>

        <h3>Technical information</h3>
        <p>
          Like every website, our servers and hosting provider receive your IP
          address and basic browser information when you load a page. We use
          this only to deliver the site, keep it secure and limit abuse (for
          example, how many accounts can be created from one network). We
          don&apos;t use it to build a profile of you, and we don&apos;t attach
          it to your shipments. We do not currently use third-party analytics
          services.
        </p>

        <h2 id="in-your-browser">What stays in your browser</h2>
        <p>
          We use your browser&apos;s local storage to remember the street
          address you typed and similar on-device preferences, so you
          don&apos;t have to type them again. This information stays on your
          device and is not sent to us. You can remove it at any time by
          clearing this site&apos;s data in your browser settings.
        </p>

        <h2 id="cookies">Cookies</h2>
        <p>
          <strong>One essential cookie.</strong> When you create a radar or sign
          in, we set a single session cookie that keeps you signed in to your
          dashboard. It contains your secret sign-in key, is only sent to{" "}
          {SITE_NAME} over a secure connection and can&apos;t be read by other
          websites or by scripts on the page. Without it the dashboard
          can&apos;t work, so it doesn&apos;t need consent.
        </p>
        <p>
          <strong>Advertising cookies.</strong> When ads are shown, Google and
          its partners may set and read cookies, or use web beacons and IP
          addresses, to serve and measure those ads. The next section explains
          this in detail.
        </p>

        <h2 id="advertising">Advertising (Google AdSense)</h2>
        <p>
          {SITE_NAME} is free. To pay for it, some pages (such as our guides,
          the home page and the area below your dashboard&apos;s answer) may show
          ads served by Google AdSense.
        </p>
        <ul>
          <li>
            Third-party vendors, including Google, use cookies to serve ads
            based on your prior visits to this website or other websites.
          </li>
          <li>
            Google&apos;s use of advertising cookies enables it and its
            partners to serve ads to you based on your visits to this site
            and/or other sites on the Internet.
          </li>
          <li>
            You can opt out of personalized advertising by visiting{" "}
            <a href="https://adssettings.google.com">Google Ads Settings</a>.
            You can also opt out of some third-party vendors&apos; use of
            cookies for personalized advertising at{" "}
            <a href="https://www.aboutads.info">www.aboutads.info</a>.
          </li>
          <li>
            Learn more in{" "}
            <a href="https://policies.google.com/technologies/partner-sites">
              How Google uses information from sites or apps that use our
              services
            </a>
            .
          </li>
        </ul>
        <p>
          Ads are chosen by Google, not by us. We never give Google or any
          advertiser your shipments, tracking numbers, ZIP or postcode, or your
          forwarding address, and we don&apos;t use the contents of your
          carrier emails for advertising.
        </p>

        <h3 id="consent">Visitors in the EEA, the UK and Switzerland</h3>
        <p>
          If you visit from the European Economic Area, the United Kingdom or
          Switzerland, Google&apos;s consent message asks for your choice
          before personalized ads or advertising cookies are used. You can
          change your choice at any time through the privacy link shown by
          that message. We process the data needed to run your radar because
          you asked us to provide the service; we rely on your consent for
          advertising cookies.
        </p>

        <h3 id="us-states">US state privacy rights</h3>
        <p>
          We don&apos;t sell your personal information for money. Under some US
          state laws (for example in California, Colorado, Connecticut,
          Virginia and others), letting Google use advertising cookies can
          count as &ldquo;selling&rdquo; or &ldquo;sharing&rdquo; personal
          information. Visitors from those states can opt out through the{" "}
          <strong>Do Not Sell or Share My Personal Information</strong> link in
          Google&apos;s US state privacy message; after you opt out, Google
          restricts how it uses your data and shows non-personalized ads.
          Residents of these states may also
          have the right to know, access, correct and delete their personal
          information. Email us to use any of these rights; we won&apos;t
          treat you differently for doing so.
        </p>

        <h2 id="how-we-use">How we use and share information</h2>
        <p>We use the information above only to:</p>
        <ul>
          <li>show your dashboard and tell you what is on the way;</li>
          <li>help you set up the carrier programs and email forwarding;</li>
          <li>find and fix emails our software didn&apos;t understand;</li>
          <li>keep the service secure and prevent abuse.</li>
        </ul>
        <p>
          We share information only with the service providers that run{" "}
          {SITE_NAME} for us (our hosting provider and our email-receiving
          service), with Google for advertising as described above, or when
          the law requires it. We don&apos;t sell or rent your data.
        </p>

        <h2 id="retention">How long we keep data</h2>
        <ul>
          <li>
            Delivered shipments disappear from your dashboard after a few days.
            The shipment details stay attached to your account until you delete
            your data.
          </li>
          <li>
            The email processing log keeps only the most recent entries (a few
            hundred at most).
          </li>
          <li>
            Your account stays until you delete it. We may remove old data
            automatically in the future and will update this policy when we
            do.
          </li>
        </ul>

        <h2 id="delete">Deleting your data</h2>
        <p>
          Open your dashboard, go to settings and choose{" "}
          <strong>Delete my data</strong>. This immediately and permanently
          deletes your account, your shipments, your email log and any
          forwarding codes. Remember to also turn off the forwarding filter in
          your email account; emails that arrive for a deleted address are
          discarded. If you can&apos;t sign in any more, email us the
          forwarding address you were given during setup (it starts with{" "}
          <code>r-</code>) and we&apos;ll delete that radar for you.
        </p>

        <h2 id="your-rights">Your rights</h2>
        <p>
          Depending on where you live, you may have the right to access,
          correct, export or delete your personal data, to object to or
          restrict how we use it, and to complain to your local data
          protection authority. You can see everything we hold on your
          dashboard, change your ZIP or postcode in settings and delete
          everything yourself. For anything else, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2 id="security">Security</h2>
        <p>
          The site is served over HTTPS. Your sign-in key is a long random
          secret that we store only in hashed form, and your forwarding
          address is random, so it can&apos;t be guessed; it only lets someone
          send email to your radar, never read it. No system is perfectly
          secure, so treat your sign-in key like a password and don&apos;t
          share it.
        </p>

        <h2 id="children">Children</h2>
        <p>
          {SITE_NAME} is not intended for children under 13, and we don&apos;t
          knowingly collect information from them. If you believe a child has
          created a radar, contact us and we will delete it.
        </p>

        <h2 id="international">Where data is processed</h2>
        <p>
          Our service providers may process data in countries other than
          yours, including the United States. Where the law requires it, we
          rely on appropriate safeguards for those transfers.
        </p>

        <h2 id="changes">Changes to this policy</h2>
        <p>
          If we change how we handle your data, we will update this page and
          the effective date at the top before the change takes effect.
        </p>

        <h2 id="contact">Contact</h2>
        <p>
          Questions or requests about privacy:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See also our{" "}
          <Link href="/terms">terms of use</Link>.
        </p>
      </div>
    </Container>
  );
}
