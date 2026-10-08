import Link from "next/link";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { CONTACT_EMAIL, SITE_NAME, pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Contact",
  description:
    "Get help with Package Radar setup, report a carrier email we didn't understand, or ask a privacy question. Here's how to reach us and what to include.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <PageHeader
        eyebrow="Contact"
        title="Get in touch"
        description={`Questions about setup, carrier emails ${SITE_NAME} didn't understand, privacy requests and ideas are all welcome.`}
      />

      <Card padding="lg" className="mb-10 space-y-2">
        <h2 className="text-lg font-semibold">Email us</h2>
        <p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-lg font-semibold break-all text-accent underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="text-[0.9375rem] text-muted">
          We aim to reply within a few business days.
        </p>
      </Card>

      <div className="article">
        <h2 id="what-to-include">What to include</h2>
        <ul>
          <li>
            <strong>Setup questions:</strong> which carrier program or email
            provider (Gmail, Outlook, iCloud, Yahoo…) you&apos;re working with,
            and the step where you got stuck.
          </li>
          <li>
            <strong>A carrier email we missed or misread:</strong> the carrier,
            roughly when the email arrived, and what the dashboard showed. You
            may include the tracking number if you&apos;re comfortable sharing
            it.
          </li>
          <li>
            <strong>Privacy or data requests:</strong> what you&apos;d like us
            to do. If you can&apos;t sign in any more, include your forwarding
            address (it starts with <code>r-</code>) so we can find your radar.
          </li>
        </ul>
        <p>
          <strong>Never send us your sign-in key or any password.</strong> We
          will never ask for them.
        </p>
      </div>

      <Callout tone="warning" title="We can't track packages for you" className="mt-10">
        <p>
          {SITE_NAME} can only show what your carriers&apos; own alerts tell
          you, and we can&apos;t look up a package, an address or a tracking
          number on anyone&apos;s behalf. For a late, missing or damaged
          package, contact the sender or the carrier directly. Our{" "}
          <Link href="/guides" className="font-medium underline underline-offset-4">
            guides
          </Link>{" "}
          explain what to do in common situations.
        </p>
      </Callout>
    </Container>
  );
}
