import Link from "next/link";
import { Brand } from "@/components/site/Brand";
import { DevPlaceholder } from "@/components/site/DevPlaceholder";
import { formatIsoDate } from "@/components/site/guides";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE, type OperatorInfo } from "@/lib/site";

export interface TermsOfUseProps {
  operator: OperatorInfo;
  /** Show "set this env var" notes for missing operator details (development builds only). */
  showPlaceholders: boolean;
  contactEmail?: string;
}

/** The terms of use (the /terms page body). Pure: everything comes from props and constants. */
export function TermsOfUse({
  operator,
  showPlaceholders,
  contactEmail = CONTACT_EMAIL,
}: TermsOfUseProps) {
  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <PageHeader
        title="Terms of use"
        description={
          <>
            These terms are written to be read. By using <Brand />, you agree
            to them.
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

      <div className="article">
        <h2 id="who">Who provides <Brand /></h2>
        <p>
          <Brand /> is provided by{" "}
          {operator.nameIsSet ? (
            <span translate="no">{operator.name}</span>
          ) : showPlaceholders ? (
            <DevPlaceholder>
              set NEXT_PUBLIC_OPERATOR_NAME to the legal name of the person or
              company that runs this site
            </DevPlaceholder>
          ) : (
            "its operator"
          )}{" "}
          (&ldquo;we&rdquo; or &ldquo;us&rdquo;). You can reach us at{" "}
          <a href={`mailto:${contactEmail}`} translate="no">
            {contactEmail}
          </a>
          .
        </p>

        <h2 id="service">What <Brand /> is</h2>
        <p>
          <Brand /> is a free website that helps you see packages on the way
          to you. You turn on the free delivery-alert programs that carriers
          and postal services offer, forward their emails to a personal address
          we give you, and we show the shipments from those emails on one
          dashboard.
        </p>
        <p>
          <Brand /> cannot look up packages by address, has no access to any
          carrier&apos;s or postal service&apos;s systems and only knows what
          is in the emails you forward to it.
        </p>

        <h2 id="availability">Availability varies by country and carrier</h2>
        <p>
          <Brand /> can be used from anywhere, but what it can do for you
          depends on your country, your carriers and your email provider:
        </p>
        <ul>
          <li>
            Carrier and postal programs differ from country to country. Some
            verify your address and alert you about parcels heading there;
            others only alert you about parcels where the sender used your
            email address or phone number.
          </li>
          <li>
            Some carriers send alerts only by text message or in their app,
            and some email providers don&apos;t allow automatic forwarding.
            We can&apos;t receive those alerts.
          </li>
          <li>
            We don&apos;t support every country, carrier, language or email
            format, and what we support can change without notice.
          </li>
        </ul>

        <h2 id="eligibility">Who can use it</h2>
        <p>
          You must be at least 16 years old to use <Brand />. Use it only
          where doing so is lawful for you.
        </p>

        <h2 id="no-guarantees">Informational only, with no guarantees</h2>
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;, for your information only. We work hard to make it
          accurate, but we can&apos;t guarantee that it is complete, correct
          or always available. In particular:
        </p>
        <ul>
          <li>
            Carrier programs don&apos;t cover every package. Some shipments
            never generate an email, some emails arrive late, and some
            carriers or delivery services aren&apos;t covered at all.
          </li>
          <li>
            Carriers change their emails without notice, so our software can
            miss a shipment or read a detail wrongly.
          </li>
          <li>
            Expected delivery dates come from the carriers and can change.
          </li>
        </ul>
        <p>
          For anything important, such as a valuable, time-sensitive or
          missing package, always check the carrier&apos;s official tracking
          page or contact the carrier or the sender directly. Don&apos;t rely
          on <Brand /> alone.
        </p>

        <h2 id="your-email">Forward only email you&apos;re allowed to forward</h2>
        <p>
          You may only forward email from email accounts that you own or are
          authorized to manage, and only email that you are allowed to process
          and share with us. Carrier emails can contain other people&apos;s
          information, such as the name of someone in your household or, for
          some postal services, images of letters addressed to them. Forward
          them only if you are entitled to receive that mail, for example
          because you live at that address. Don&apos;t forward other
          people&apos;s email without their permission, and don&apos;t use{" "}
          <Brand /> to watch deliveries to someone else&apos;s home. You are
          responsible for following the laws that apply to the email you
          forward.
        </p>

        <h2 id="account">Your sign-in key</h2>
        <p>
          When you create a radar you get a secret sign-in key. Anyone who has
          it can see your dashboard, so keep it private. We only store a
          hashed copy, which means we can&apos;t show it to you again or
          recover it. You can create a new key from your dashboard settings
          while you are signed in.
        </p>

        <h2 id="fair-use">Fair use</h2>
        <p>Please don&apos;t:</p>
        <ul>
          <li>send spam, malware or anything other than delivery-related email to your forwarding address;</li>
          <li>try to access other people&apos;s radars or guess forwarding addresses or sign-in keys;</li>
          <li>overload, scrape, probe or disrupt the service, or get around its limits;</li>
          <li>
            use <Brand /> for anything illegal, or to stalk, harass or harm
            anyone.
          </li>
        </ul>
        <p>
          We may limit, suspend or delete radars that break these rules or put
          the service or other people at risk.
        </p>

        <h2 id="independent">Not affiliated with any postal service or carrier</h2>
        <p>
          <Brand /> is independent and not affiliated with, endorsed by or
          sponsored by any postal service, carrier or retailer. Carrier, postal
          service and program names are trademarks of their owners and are
          used only to describe which emails the service understands. Links to
          carrier websites take you to services that have their own terms and
          privacy policies.
        </p>

        <h2 id="liability">Limits of our responsibility</h2>
        <p>
          To the fullest extent the law allows, we are not liable for any loss
          or damage arising from your use of the service, including missed,
          late, lost or stolen packages, or decisions made based on
          information shown on the site. Nothing in these terms excludes or
          limits liability that cannot be excluded or limited under the law
          that applies to you, such as liability for fraud, or for death or
          personal injury caused by negligence.
        </p>

        <h2 id="consumer-rights">Your rights as a consumer</h2>
        <p>
          If you use <Brand /> as a consumer, nothing in these terms affects
          the rights you have under the mandatory consumer protection laws of
          the country where you live. Where those laws give you more
          protection than these terms, those laws apply.
        </p>

        <h2 id="governing-law">Governing law and disputes</h2>
        <p>
          {operator.country ? (
            <>
              These terms are governed by the laws of{" "}
              <span translate="no">{operator.country}</span>.
            </>
          ) : showPlaceholders ? (
            <>
              These terms are governed by the laws of{" "}
              <DevPlaceholder>
                set NEXT_PUBLIC_OPERATOR_COUNTRY to the country whose law
                governs these terms
              </DevPlaceholder>
              .
            </>
          ) : (
            <>
              These terms are governed by the laws of the country where we are
              established.
            </>
          )}{" "}
          If you are a consumer, you also keep the protection of the mandatory
          laws of the country where you live, and you can bring a claim in the
          courts of that country where its law allows it. If something goes
          wrong, please contact us first: most problems can be solved by
          email.
        </p>

        <h2 id="ending">Stopping and changes</h2>
        <p>
          You can stop using <Brand /> at any time and delete all your data
          with the <strong>Delete my data</strong> button in your dashboard
          settings. We may change or discontinue the service, or update these
          terms. When we update the terms we will change the effective date
          above; if you keep using the service after that, the new terms
          apply.
        </p>

        <h2 id="language">Language</h2>
        <p>
          These terms are written in English. If you read them in a
          translation, for example one made by your browser, the English
          version is the one that applies.
        </p>

        <h2 id="privacy">Privacy</h2>
        <p>
          Our <Link href="/privacy">privacy policy</Link> explains what we
          collect, how long we keep it and how we use it, including advertising
          cookies.
        </p>

        <h2 id="contact">Contact</h2>
        <p>
          Questions about these terms:{" "}
          <a href={`mailto:${contactEmail}`} translate="no">
            {contactEmail}
          </a>
          .
        </p>
      </div>
    </Container>
  );
}
