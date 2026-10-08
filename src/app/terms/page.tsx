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
  title: "Terms of use",
  description:
    "The plain-English terms for using Package Radar: what the service does and doesn't promise, forwarding only email you own, fair use and how to contact us.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <PageHeader
        title="Terms of use"
        description={`These terms are written to be read. By using ${SITE_NAME}, you agree to them.`}
      >
        <p className="text-sm text-muted">
          Effective{" "}
          <time dateTime={LEGAL_EFFECTIVE_DATE}>
            {formatIsoDate(LEGAL_EFFECTIVE_DATE)}
          </time>
        </p>
      </PageHeader>

      <div className="article">
        <h2 id="service">What {SITE_NAME} is</h2>
        <p>
          {SITE_NAME} is a free website that helps you see packages on the way
          to your home. You turn on the free delivery-alert programs that
          carriers offer to verified residents (such as USPS Informed Delivery,
          UPS My Choice and FedEx Delivery Manager), forward those carriers&apos;
          emails to a personal address we give you, and we show the shipments
          from those emails on one dashboard.
        </p>
        <p>
          {SITE_NAME} cannot look up packages by address, does not have access
          to any carrier&apos;s systems and only knows what is in the emails
          you forward to it.
        </p>

        <h2 id="no-guarantees">Informational only — no guarantees</h2>
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
          on {SITE_NAME} alone.
        </p>

        <h2 id="your-email">Forward only email you&apos;re allowed to forward</h2>
        <p>
          You may only forward email from accounts that you own or that you
          are authorized to manage, and only about deliveries to an address
          where you live or are entitled to receive mail. Don&apos;t forward
          other people&apos;s email without their permission, and don&apos;t
          use {SITE_NAME} to watch deliveries to someone else&apos;s home.
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
          <li>use {SITE_NAME} for anything illegal, or to stalk, harass or harm anyone.</li>
        </ul>
        <p>
          We may limit, suspend or delete radars that break these rules or put
          the service or other people at risk.
        </p>

        <h2 id="independent">Not affiliated with any carrier</h2>
        <p>
          {SITE_NAME} is independent and not affiliated with, endorsed by or
          sponsored by USPS, UPS, FedEx, Amazon, DHL or any other carrier or
          retailer. Carrier and program names are trademarks of their owners
          and are used only to describe which emails the service understands.
          Links to carrier websites take you to services that have their own
          terms and privacy policies.
        </p>

        <h2 id="liability">Limits of our responsibility</h2>
        <p>
          To the fullest extent the law allows, {SITE_NAME} and the people who
          run it are not liable for any loss or damage arising from your use
          of the service, including missed, late, lost or stolen packages, or
          decisions made based on information shown on the site. Nothing in
          these terms limits rights you have under consumer protection laws
          that can&apos;t be waived.
        </p>

        <h2 id="ending">Stopping and changes</h2>
        <p>
          You can stop using {SITE_NAME} at any time and delete all your data
          with the <strong>Delete my data</strong> button in your dashboard
          settings. We may change or discontinue the service, or update these
          terms. When we update the terms we will change the effective date
          above; if you keep using the service after that, the new terms
          apply.
        </p>

        <h2 id="privacy">Privacy</h2>
        <p>
          Our <Link href="/privacy">privacy policy</Link> explains what we
          collect and how we use it, including advertising cookies.
        </p>

        <h2 id="contact">Contact</h2>
        <p>
          Questions about these terms:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </div>
    </Container>
  );
}
