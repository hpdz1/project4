import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/site/Brand";
import { DevPlaceholder } from "@/components/site/DevPlaceholder";
import { formatIsoDate } from "@/components/site/guides";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { LEGAL_EFFECTIVE_DATE, type OperatorInfo } from "@/lib/site";
import {
  DELIVERED_RETENTION_MS,
  EMAIL_LOG_LIMIT,
  EMAIL_LOG_RETENTION_MS,
  STALE_SHIPMENT_RETENTION_MS,
  VERIFICATION_RETENTION_MS,
} from "@/lib/store/limits";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * The retention schedule as published, derived from the limits the store's
 * purge enforces (src/lib/store/limits.ts) so the policy can't drift from
 * the code.
 */
export const RETENTION = {
  deliveredDays: Math.round(DELIVERED_RETENTION_MS / DAY_MS),
  staleDays: Math.round(STALE_SHIPMENT_RETENTION_MS / DAY_MS),
  emailLogDays: Math.round(EMAIL_LOG_RETENTION_MS / DAY_MS),
  emailLogRows: EMAIL_LOG_LIMIT,
  verificationHours: Math.round(VERIFICATION_RETENTION_MS / HOUR_MS),
} as const;

/** Name of the session cookie (src/lib/server/session.ts SESSION_COOKIE). */
const SESSION_COOKIE_NAME = "pr_session";
/** Its lifetime in days (src/lib/server/session.ts SESSION_MAX_AGE_SECONDS). */
const SESSION_COOKIE_DAYS = 400;
/** Browser storage keys (src/lib/client/saved-location.ts LOCAL_KEYS). */
const LOCAL_STORAGE_KEYS = { location: "pr.location", provider: "pr.provider" } as const;

/** Sections in reading order, for the table of contents. */
export const PRIVACY_SECTIONS = [
  { id: "short-version", title: "The short version" },
  { id: "who-we-are", title: "Who we are" },
  { id: "what-we-collect", title: "What we collect and why" },
  { id: "not-kept", title: "What we receive but don't keep" },
  { id: "item-descriptions", title: "Item descriptions are never stored" },
  { id: "legal-bases", title: "Legal bases" },
  { id: "retention", title: "How long we keep data" },
  { id: "cookies", title: "Cookies and browser storage" },
  { id: "advertising", title: "Advertising (Google AdSense)" },
  { id: "gpc-dnt", title: "Global Privacy Control and Do Not Track" },
  { id: "sharing", title: "Who we share data with" },
  { id: "transfers", title: "International transfers" },
  { id: "your-rights", title: "Your rights" },
  { id: "children", title: "Children" },
  { id: "security", title: "Security" },
  { id: "language", title: "Language" },
  { id: "changes", title: "Changes to this policy" },
  { id: "contact", title: "Contact" },
] as const;

export interface PrivacyPolicyProps {
  operator: OperatorInfo;
  /** Show "set this env var" notes for missing operator details (development builds only). */
  showPlaceholders: boolean;
}

function Mail({ address }: { address: string }) {
  return (
    <a href={`mailto:${address}`} translate="no">
      {address}
    </a>
  );
}

/** Text the operator configured (names, addresses): never machine-translated. */
function Configured({ children }: { children: ReactNode }) {
  return <span translate="no">{children}</span>;
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <tr>
      <th scope="row">{term}</th>
      <td>{children}</td>
    </tr>
  );
}

/** "Who we are": the controller's identity and contact details. */
function OperatorTable({ operator, showPlaceholders }: PrivacyPolicyProps) {
  return (
    <div className="table-scroll">
      <table>
        <tbody>
          <Row term="Operator (controller)">
            {operator.nameIsSet ? (
              <Configured>{operator.name}</Configured>
            ) : showPlaceholders ? (
              <DevPlaceholder>
                set NEXT_PUBLIC_OPERATOR_NAME to the legal name of the person or
                company that runs this site
              </DevPlaceholder>
            ) : (
              <>
                The operator of <Brand />
              </>
            )}
          </Row>
          {operator.address ? (
            <Row term="Postal address">
              <Configured>{operator.address}</Configured>
            </Row>
          ) : showPlaceholders ? (
            <Row term="Postal address">
              <DevPlaceholder>
                set NEXT_PUBLIC_OPERATOR_ADDRESS to the operator&apos;s postal
                address. Privacy laws in many countries expect it here.
              </DevPlaceholder>
            </Row>
          ) : null}
          {operator.country ? (
            <Row term="Established in">
              <Configured>{operator.country}</Configured>
            </Row>
          ) : showPlaceholders ? (
            <Row term="Established in">
              <DevPlaceholder>
                set NEXT_PUBLIC_OPERATOR_COUNTRY to the country where the
                operator is established
              </DevPlaceholder>
            </Row>
          ) : null}
          <Row term="Privacy contact">
            <Mail address={operator.privacyEmail} />
          </Row>
          {operator.euRepresentative ? (
            <Row term="Representative in the EU">
              <Configured>{operator.euRepresentative}</Configured>
            </Row>
          ) : null}
          {operator.ukRepresentative ? (
            <Row term="Representative in the UK">
              <Configured>{operator.ukRepresentative}</Configured>
            </Row>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** The privacy policy (the /privacy page body). Pure: everything comes from props and constants. */
export function PrivacyPolicy({ operator, showPlaceholders }: PrivacyPolicyProps) {
  const r = RETENTION;
  const privacyEmail = operator.privacyEmail;
  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <PageHeader
        title="Privacy policy"
        description={
          <>
            <Brand /> is built to know as little about you as possible. This
            page explains what we collect, why, how long we keep it and how to
            delete it, wherever you live.
          </>
        }
      >
        <p className="text-sm text-muted">
          Effective{" "}
          <time dateTime={LEGAL_EFFECTIVE_DATE}>
            {formatIsoDate(LEGAL_EFFECTIVE_DATE)}
          </time>
        </p>
      </PageHeader>

      <nav
        aria-labelledby="privacy-toc"
        className="mb-10 rounded-2xl border border-border bg-subtle p-5"
      >
        <h2 id="privacy-toc" className="text-base font-semibold">
          On this page
        </h2>
        <ol className="mt-3 grid list-decimal gap-x-8 gap-y-1.5 pl-5 text-[0.9375rem] text-muted sm:grid-cols-2">
          {PRIVACY_SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="article">
        <h2 id="short-version">The short version</h2>
        <ul>
          <li>
            Your street address stays in your browser. Our servers only receive
            your country, postcode (ZIP) and state or region.
          </li>
          <li>
            From the carrier emails you forward to us, we keep only the
            shipment details: carrier, tracking or order number, shipper,
            status and dates. We never keep item descriptions, email bodies,
            attachments or images.
          </li>
          <li>
            Old data is deleted automatically: delivered shipments{" "}
            {r.deliveredDays} days after delivery, shipments with no news after{" "}
            {r.staleDays} days, the email log after {r.emailLogDays} days and
            forwarding confirmations after {r.verificationHours} hours.
          </li>
          <li>
            We never ask for your carrier or email passwords, never log in to
            carrier websites for you and never sell your data.
          </li>
          <li>
            Some pages show ads from Google, which uses cookies. Where the law
            requires it, you are asked for consent first, and you can always
            opt out of personalized ads.
          </li>
          <li>
            <strong>Download my data</strong> and{" "}
            <strong>Delete my data</strong> in your dashboard settings give you
            a copy of everything we hold, or delete all of it, immediately.
          </li>
        </ul>

        <h2 id="who-we-are">Who we are</h2>
        <p>
          <Brand /> is a free website that collects the delivery alerts your
          carriers and postal services send you and shows them on one
          dashboard. The person or company below runs it and is responsible
          for your personal data (the &ldquo;controller&rdquo;, also called
          &ldquo;we&rdquo; or &ldquo;us&rdquo; on this page).
        </p>
        <OperatorTable operator={operator} showPlaceholders={showPlaceholders} />
        <p>
          The same contact handles privacy questions from every country,
          including requests to the person in charge of personal information
          (Quebec), the privacy officer (South Korea) and grievances (India).
        </p>

        <h2 id="what-we-collect">What we collect and why</h2>

        <h3>When you check your address</h3>
        <p>
          When you type your address on the home page or in setup, code
          running in your own browser works out your country, postcode and
          state or region, so we can show which carrier and postal programs
          cover you. The street part of the address is never sent to our
          servers.
        </p>

        <h3>When you set up your radar</h3>
        <p>To run your radar, we store:</p>
        <ul>
          <li>your country, postcode and state or region;</li>
          <li>
            your time zone, so &ldquo;arriving today&rdquo; means today where
            you live;
          </li>
          <li>
            a random account ID and your personal forwarding address (for
            example <code translate="no">r-k3j9x2m4q8w1@…</code>);
          </li>
          <li>
            a scrambled (hashed) copy of your secret sign-in key. We never
            store the key itself, so we can&apos;t see or recover it;
          </li>
          <li>
            which carrier programs you marked as done or skipped during setup;
          </li>
          <li>
            how many emails we have received for you, when the latest one
            arrived and, for each kind of carrier email, when we last saw one;
          </li>
          <li>when your account was created and last changed.</li>
        </ul>
        <p>
          We don&apos;t ask for your name, street address, phone number, email
          address or any password.
        </p>

        <h3>From the carrier emails you forward</h3>
        <p>
          When an email reaches your forwarding address, our software reads it
          automatically and saves only these shipment details:
        </p>
        <ul>
          <li>the carrier or postal service (for example UPS, DHL or Royal Mail);</li>
          <li>
            the tracking number, or a shop&apos;s order number when there is no
            tracking number;
          </li>
          <li>the shipper&apos;s name (usually the shop that sent it);</li>
          <li>the delivery status (for example &ldquo;out for delivery&rdquo;);</li>
          <li>
            the expected delivery date and time window, and when it was
            delivered;
          </li>
          <li>
            when we first and last heard about it, and which kind of email
            the latest news came from;
          </li>
          <li>
            your own choices about it (&ldquo;not mine&rdquo; or &ldquo;got
            it&rdquo;).
          </li>
        </ul>
        <p>
          We also keep a short log of the emails we processed: when each one
          arrived, the sender&apos;s domain (such as{" "}
          <code translate="no">ups.com</code>), what kind of email it was, how
          many shipment updates it contained and a short technical note (such
          as &ldquo;no tracking number found&rdquo;). This lets your dashboard
          tell you when a carrier feed has gone quiet and helps us fix emails
          our software didn&apos;t understand.
        </p>
        <p>
          Reading emails is fully automated. It only decides which shipment
          details to show you; it doesn&apos;t make decisions that have legal
          or similarly significant effects on you.
        </p>

        <h3>Forwarding confirmations</h3>
        <p>
          When you set up forwarding, Gmail and some other email providers
          send a confirmation to your <Brand /> address to check that you
          meant to forward there. We keep the provider&apos;s name, the
          confirmation code or link, when it arrived and the email address
          that asked to forward (your mailbox), so we can show them to you on
          the setup screen. Confirmations are deleted after{" "}
          {r.verificationHours} hours.
        </p>

        <h3>Technical information</h3>
        <p>
          Like every website, our servers and hosting provider receive your IP
          address and basic browser information when you load a page. We use
          it only to deliver the site, keep it secure and limit abuse: for
          example, we count account creations and sign-in attempts per IP
          address. Those counters are kept only in memory and expire after an
          hour.
          We don&apos;t attach your IP address to your shipments or use it to
          build a profile of you. Our hosting provider may keep server logs
          for a limited time under its own policies. We don&apos;t use
          third-party analytics services.
        </p>

        <h2 id="not-kept">What we receive but don&apos;t keep</h2>
        <p>
          Forwarded emails contain more than shipment details. Our software
          processes each email in memory when it arrives, saves only the
          fields listed above and discards the rest. In particular:
        </p>
        <ul>
          <li>
            <strong>Your email address.</strong> It appears in the headers of
            every email you forward and in forwarding confirmations. We use the
            headers only to deliver the email to your radar and don&apos;t
            store your email address, except inside a forwarding confirmation,
            which is deleted after {r.verificationHours} hours.
          </li>
          <li>
            <strong>Names and addresses.</strong> Carrier emails often include
            your name and delivery address, and sometimes the names of other
            people in your household. We don&apos;t store them.
          </li>
          <li>
            <strong>Images of your mail.</strong> Some services, such as USPS
            Informed Delivery, send daily emails with scanned images of letters
            addressed to your household. We don&apos;t store email bodies,
            attachments or images.
          </li>
          <li>
            <strong>Everything else in the email,</strong> such as its full
            text and any other details it contains.
          </li>
        </ul>
        <p>
          The email service that receives mail for us (see{" "}
          <a href="#sharing">who we share data with</a>) handles each message
          in transit and may keep it for a short time under its own settings
          and policies.
        </p>

        <h2 id="item-descriptions">Item descriptions are never stored</h2>
        <p>
          Shop and carrier emails often say what is inside a parcel. That can
          reveal very personal things, such as a pharmacy order or a medical
          product, so our software never saves item names or descriptions. We
          keep the shipper&apos;s name because it is how you recognize a
          parcel. If a shipper&apos;s name is sensitive to you, you can delete
          that shipment from your dashboard at any time. We never use shipment
          details, including shipper names, for advertising or analytics.
        </p>

        <h2 id="legal-bases">Legal bases</h2>
        <p>
          Privacy laws such as the EU and UK GDPR and Brazil&apos;s LGPD ask us
          to name the legal basis for each use of your data:
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">What we do</th>
                <th scope="col">Legal basis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Run your radar: receive your forwarded emails, extract and
                  store shipment details, show your dashboard, keep your
                  delivery area, time zone, setup checklist and forwarding
                  confirmations
                </td>
                <td>
                  <strong>Contract</strong>: it is needed to provide the
                  service you asked for
                </td>
              </tr>
              <tr>
                <td>
                  Keep the service secure and prevent abuse: rate limits per IP
                  address, server logs, blocking misuse
                </td>
                <td>
                  <strong>Legitimate interests</strong>: keeping the service
                  safe and available for everyone
                </td>
              </tr>
              <tr>
                <td>
                  Briefly process other details that arrive inside forwarded
                  emails (names, addresses, other people&apos;s information)
                  while extracting shipment details, without storing them
                </td>
                <td>
                  <strong>Legitimate interests</strong>: providing the service
                  you asked for while keeping as little as possible
                </td>
              </tr>
              <tr>
                <td>Advertising cookies and personalized ads</td>
                <td>
                  <strong>Consent</strong> where the law requires it (for
                  example in the EEA and the UK). You can withdraw it at any
                  time.
                </td>
              </tr>
              <tr>
                <td>Respond to lawful requests from authorities</td>
                <td>
                  <strong>Legal obligation</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 id="retention">How long we keep data</h2>
        <p>
          We delete data automatically on this schedule. The clean-up runs
          regularly, so an item can outlive its limit by a short time.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Kept for</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>A delivered shipment</td>
                <td>{r.deliveredDays} days after delivery</td>
              </tr>
              <tr>
                <td>Any shipment with no news</td>
                <td>
                  {r.staleDays} days after its latest update, whatever its
                  status
                </td>
              </tr>
              <tr>
                <td>The email log</td>
                <td>
                  {r.emailLogDays} days (and at most the newest{" "}
                  {r.emailLogRows} entries)
                </td>
              </tr>
              <tr>
                <td>Forwarding confirmations (codes and links)</td>
                <td>{r.verificationHours} hours</td>
              </tr>
              <tr>
                <td>
                  Your account: forwarding address, delivery area, time zone,
                  setup checklist and hashed sign-in key
                </td>
                <td>Until you delete it</td>
              </tr>
              <tr>
                <td>Rate-limit counters (IP addresses)</td>
                <td>One hour, in memory only</td>
              </tr>
              <tr>
                <td>What your browser remembers</td>
                <td>
                  Until you clear it or use <strong>Delete my data</strong> on
                  that device
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          You don&apos;t have to wait: you can delete a single shipment from
          your dashboard, or everything with <strong>Delete my data</strong>{" "}
          in your dashboard settings. That immediately and permanently deletes
          your account, shipments, email log and forwarding confirmations.
          Remember to also turn off the forwarding filter in your email
          account; emails that arrive for a deleted address are discarded. If
          backups of our database exist, deleted data disappears from them
          when they expire in the normal backup cycle.
        </p>

        <h2 id="cookies">Cookies and browser storage</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">What it does</th>
                <th scope="col">How long</th>
                <th scope="col">Consent</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code translate="no">{SESSION_COOKIE_NAME}</code> (cookie,
                  set by <Brand />)
                </td>
                <td>
                  Keeps you signed in to your dashboard. It contains your secret
                  sign-in key, is sent only to <Brand /> (over a secure
                  connection) and can&apos;t be read by other websites or by
                  scripts on the page.
                </td>
                <td>
                  Up to {SESSION_COOKIE_DAYS} days, or until you sign out
                </td>
                <td>Not needed: strictly necessary</td>
              </tr>
              <tr>
                <td>
                  <code translate="no">{LOCAL_STORAGE_KEYS.location}</code>,{" "}
                  <code translate="no">{LOCAL_STORAGE_KEYS.provider}</code>{" "}
                  (your browser&apos;s local storage)
                </td>
                <td>
                  Remember the address you typed (and the postcode and region
                  worked out from it) and the email provider you picked in
                  setup, so you don&apos;t have to enter them again. This
                  stays on your device and is not sent to us.
                </td>
                <td>Until you clear it</td>
                <td>Not needed: you asked us to remember it</td>
              </tr>
              <tr>
                <td>Google advertising cookies and similar technologies</td>
                <td>
                  Set and read by Google and its partners on pages with ads,
                  to show, personalize and measure ads, limit how often you see
                  the same ad, prevent fraud and remember your consent choices.
                </td>
                <td>Set by Google</td>
                <td>Asked first in the EEA, the UK and Switzerland</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          You can delete cookies and site data at any time in your browser
          settings. Deleting the session cookie signs you out.
        </p>

        <h2 id="advertising">Advertising (Google AdSense)</h2>
        <p>
          <Brand /> is free. To pay for it, some pages (such as our guides,
          the home page and the area below your dashboard&apos;s answer) may
          show ads served by Google AdSense. When ads are shown, third parties,
          including Google, may place and read cookies on your browser, or use
          web beacons or IP addresses, to collect information as a result of
          ad serving on this website.
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
            </a>{" "}
            and in{" "}
            <a href="https://policies.google.com/privacy">
              Google&apos;s privacy policy
            </a>
            .
          </li>
        </ul>
        <p>
          When a page with ads loads, your browser sends Google information
          such as your IP address, browser details, the address of the page
          and Google cookie identifiers, so Google can choose and measure ads.
          Google decides what it does with that information as an independent
          controller. Even ads that are not personalized may use cookies to
          limit how often you see an ad, measure ads and fight fraud.
        </p>
        <p>
          Ads are chosen by Google, not by us. We never give Google or any
          advertiser your shipments, tracking numbers, shipper names, postcode
          or forwarding address, and we don&apos;t use the contents of your
          carrier emails for advertising.
        </p>

        <h3 id="consent">Visitors in the EEA, the UK and Switzerland</h3>
        <p>
          If you visit from the European Economic Area, the United Kingdom or
          Switzerland, Google&apos;s consent message asks for your choice
          before advertising cookies are used or ads are personalized. You can
          change your choice at any time through the privacy link shown by
          that message. If you don&apos;t consent, you may still see
          non-personalized or limited ads.
        </p>

        <h3 id="us-states">Visitors in US states with privacy laws</h3>
        <p>
          We don&apos;t sell your personal information for money. Under some US
          state laws (for example in California, Colorado, Connecticut,
          Virginia and Texas), letting Google use advertising cookies can count
          as &ldquo;selling&rdquo; or &ldquo;sharing&rdquo; personal
          information, or as targeted advertising. Visitors from those states
          can opt out through the{" "}
          <strong>Do Not Sell or Share My Personal Information</strong> link in
          Google&apos;s US state privacy message. After you opt out, Google
          restricts how it uses your data and shows non-personalized ads.
        </p>

        <h2 id="gpc-dnt">Global Privacy Control and Do Not Track</h2>
        <p>
          <Brand /> itself doesn&apos;t track you across websites, doesn&apos;t
          use analytics and doesn&apos;t build a profile of you, whatever
          signals your browser sends.
        </p>
        <ul>
          <li>
            <strong>Global Privacy Control (GPC).</strong> Where Google supports
            it, a GPC signal from your browser is treated as a request to opt
            out of the sale or sharing of your personal information for
            advertising, as some US state laws require.
          </li>
          <li>
            <strong>Do Not Track.</strong> There is no agreed standard for
            responding to Do Not Track signals. Our own service doesn&apos;t
            track you, so there is nothing for it to switch off. To limit ad
            tracking, use the consent and opt-out choices above or GPC, which
            are more widely supported.
          </li>
        </ul>

        <h2 id="sharing">Who we share data with</h2>
        <p>
          We don&apos;t sell or rent your data. We share it only with:
        </p>
        <ul>
          <li>
            <strong>Our hosting provider</strong>, which runs our servers and
            stores the database described on this page, on our behalf.
          </li>
          <li>
            <strong>Our inbound email provider</strong> (such as Postmark or
            Cloudflare Email Routing), which receives the emails sent to your
            forwarding address and passes them to us, on our behalf.
          </li>
          <li>
            <strong>Google</strong>, for advertising, as described above. Google
            acts as an independent controller.
          </li>
          <li>
            <strong>Authorities</strong>, when the law requires it.
          </li>
          <li>
            <strong>A new operator</strong>, if <Brand /> is ever transferred
            to someone else. This policy would continue to apply to your data,
            and we would announce the change on this page.
          </li>
        </ul>
        <p>
          Our service providers may only use your data to provide their
          services to us, under contracts that require them to protect it.
        </p>

        <h2 id="transfers">International transfers</h2>
        <p>
          <Brand /> is used around the world, and our service providers may
          process data in countries other than yours, including the United
          States and countries in the European Union. Some of those countries
          have different data protection rules from yours.
        </p>
        <p>
          When personal data from the EEA, the UK or Switzerland goes to a
          country that doesn&apos;t have an adequacy decision, we rely on
          appropriate safeguards, such as the European Commission&apos;s
          Standard Contractual Clauses (with the UK addendum where needed) or,
          where the provider participates, the EU-U.S. Data Privacy Framework
          and its UK and Swiss extensions. Where other laws (for example in
          Japan, South Korea or Brazil) require information or safeguards for
          transfers abroad, we rely on our providers&apos; contractual
          protections. Ask us for the details of any transfer, including the
          countries involved.
        </p>

        <h2 id="your-rights">Your rights</h2>
        <p>Wherever you live, you can do this yourself at any time:</p>
        <ul>
          <li>
            <strong>See</strong> your shipments and settings on your
            dashboard.
          </li>
          <li>
            <strong>Get a copy</strong> of all your data in a machine-readable
            file (JSON) with <strong>Download my data</strong> in your
            dashboard settings.
          </li>
          <li>
            <strong>Correct</strong> your delivery area from your dashboard
            settings.
          </li>
          <li>
            <strong>Delete</strong> a single shipment from your dashboard, or
            everything with <strong>Delete my data</strong>.
          </li>
        </ul>
        <p>
          For anything else, email <Mail address={privacyEmail} />. We answer
          within one month at the latest, or sooner where your local law
          requires it, and we won&apos;t treat you differently for using your
          rights. Depending on where you live, you also have these rights:
        </p>

        <h3 id="rights-eea-uk">European Economic Area, United Kingdom and Switzerland</h3>
        <p>
          Under the EU GDPR, the UK GDPR and the Swiss data protection act you
          have the right to access your data, to data portability (use{" "}
          <strong>Download my data</strong>), to rectification, to erasure
          (use <strong>Delete my data</strong>), to restriction of processing,
          to object to processing based on our legitimate interests, and to
          withdraw consent at any time. You can also complain to a supervisory
          authority, such as the data protection authority in the country
          where you live or work, the UK Information Commissioner&apos;s
          Office (ICO) or the Swiss Federal Data Protection and Information
          Commissioner (FDPIC).
        </p>

        <h3 id="rights-brazil">Brazil</h3>
        <p>
          Under the LGPD you can ask us to confirm whether we process your
          data, access it, correct it, anonymize, block or delete data that is
          unnecessary, receive it in a portable format, learn who we share it
          with, and revoke consent. You can also complain to the national data
          protection authority (ANPD).
        </p>

        <h3 id="rights-canada">Canada</h3>
        <p>
          Under PIPEDA and, in Quebec, Law 25, you can access and correct your
          personal information and withdraw consent, subject to legal limits.
          You can complain to the Office of the Privacy Commissioner of Canada
          or, in Quebec, to the Commission d&apos;accès à l&apos;information.
        </p>

        <h3 id="rights-australia">Australia</h3>
        <p>
          Where the Privacy Act 1988 applies, you can access and correct your
          personal information. If you&apos;re not happy with how we handle a
          complaint, you can contact the Office of the Australian Information
          Commissioner (OAIC).
        </p>

        <h3 id="rights-japan">Japan</h3>
        <p>
          Under the APPI you can ask us to disclose the personal data we hold
          about you, including records of any provision to third parties, and
          to correct, add to or delete it, or stop using or providing it. You
          can also contact the Personal Information Protection Commission.
        </p>

        <h3 id="rights-korea">South Korea</h3>
        <p>
          Under the PIPA you can ask to access, correct or delete your personal
          information or suspend its processing. Our privacy officer is the
          operator named in <a href="#who-we-are">Who we are</a>. You can also
          complain to the Personal Information Protection Commission.
        </p>

        <h3 id="rights-india">India</h3>
        <p>
          As the Digital Personal Data Protection Act comes into force, you can
          ask for a summary of your data and how it is processed, have it
          corrected, completed or erased, nominate someone to use your rights
          if you die or can&apos;t act, and raise a grievance with us. If we
          don&apos;t resolve it, you can complain to the Data Protection Board
          of India.
        </p>

        <h3 id="rights-us">United States</h3>
        <p>
          Residents of California and other US states with consumer privacy
          laws may have the right to know what personal information we collect
          and access it, to correct it, to delete it, to get a portable copy,
          and to opt out of its sale or sharing, of targeted advertising and of
          profiling (see{" "}
          <a href="#us-states">Visitors in US states with privacy laws</a>).
          You can use an authorized agent; we may ask the agent for proof of
          their authority. If we decline your request, you can appeal by
          replying to our answer, and if you disagree with the outcome you can
          contact your state&apos;s attorney general. We don&apos;t knowingly
          sell or share the personal information of anyone under 16.
        </p>

        <h3 id="verification">How we confirm it&apos;s you</h3>
        <p>
          We don&apos;t know your name or email address, so the dashboard
          tools above are the safest way to use your rights. If you can&apos;t
          sign in any more, email us the forwarding address you were given
          during setup (it starts with <code translate="no">r-</code>). We can
          delete that radar for you, but to protect you from impostors we
          can&apos;t send its data to an email address.
        </p>

        <h2 id="children">Children</h2>
        <p>
          <Brand /> is not directed to children. You must be at least 16 years
          old to use it, and we don&apos;t knowingly collect personal data from
          anyone younger. If you believe a child has created a radar, contact
          us and we will delete it.
        </p>

        <h2 id="security">Security</h2>
        <p>
          The site is served over HTTPS. Your sign-in key is a long random
          secret that we store only in hashed form. Your forwarding address is
          random, so it can&apos;t be guessed, and it only lets someone send
          email to your radar, never read it. We never store email bodies, and
          we delete old data on the schedule above, so there is less to
          expose. No system is perfectly secure, so treat your sign-in key like a
          password and don&apos;t share it.
        </p>
        <p>
          If a security incident affects your data, we will notify the
          authorities where the law requires it. Because we don&apos;t have
          your email address, we will tell you through a notice on this site
          and in your dashboard.
        </p>

        <h2 id="language">Language</h2>
        <p>
          This policy is written in English. If you read it in a translation,
          for example one made by your browser, the English version is the one
          that applies.
        </p>

        <h2 id="changes">Changes to this policy</h2>
        <p>
          If we change how we handle your data, we will update this page and
          the effective date at the top before the change takes effect.
        </p>
        <ul>
          <li>
            <time dateTime="2026-10-10">{formatIsoDate("2026-10-10")}</time>:
            rewritten for visitors worldwide. Added the retention schedule,
            legal bases, rights by region, data download and international
            transfers. Item descriptions are no longer stored, and existing
            ones are deleted.
          </li>
          <li>
            <time dateTime="2026-10-08">{formatIsoDate("2026-10-08")}</time>:
            first version.
          </li>
        </ul>

        <h2 id="contact">Contact</h2>
        <p>
          Questions or requests about privacy, from anywhere in the world:{" "}
          <Mail address={privacyEmail} />.
          {operator.address ? (
            <>
              {" "}
              By post: <Configured>{operator.address}</Configured>.
            </>
          ) : null}
          {operator.euRepresentative || operator.ukRepresentative ? (
            <>
              {" "}
              You can also contact our representatives listed in{" "}
              <a href="#who-we-are">Who we are</a>.
            </>
          ) : null}{" "}
          See also our <Link href="/terms">terms of use</Link>.
        </p>
      </div>
    </Container>
  );
}
