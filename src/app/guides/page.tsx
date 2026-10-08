import Link from "next/link";
import type { Route } from "next";
import { GUIDES } from "@/content/guides";
import { groupGuidesByCategory, formatIsoDate } from "@/components/site/guides";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Guides: carrier delivery alerts, explained",
  description:
    "Plain-English guides to USPS Informed Delivery, UPS My Choice, FedEx Delivery Manager and other free carrier programs: how to sign up, what they show, how to spot fake delivery texts and what to do when a package goes missing.",
  path: "/guides",
});

function slugifyCategory(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function GuidesIndexPage() {
  const groups = groupGuidesByCategory(GUIDES.map((g) => g.meta));

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        eyebrow="Guides"
        title="Know what's coming to your door"
        description="Carriers already know which packages are headed to your home, and most of them will tell you for free once you prove you live there. These guides explain each program, how to set it up, and what to do when something looks wrong."
      />

      {groups.length === 0 ? (
        <p className="text-muted">
          Our first guides are being written. In the meantime, the{" "}
          <Link href="/about" className="font-medium text-accent underline underline-offset-4">
            About page
          </Link>{" "}
          explains how Package Radar works.
        </p>
      ) : (
        <div className="space-y-12">
          {groups.map((group) => {
            const headingId = `category-${slugifyCategory(group.category)}`;
            return (
              <section key={group.category} aria-labelledby={headingId}>
                <h2 id={headingId} className="mb-4 text-xl font-bold tracking-tight">
                  {group.category}
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {group.guides.map((meta) => (
                    <Card as="li" key={meta.slug} className="relative flex flex-col gap-2 transition-colors hover:border-accent/50">
                      <h3 className="text-lg leading-snug font-semibold">
                        <Link
                          href={`/guides/${meta.slug}` as Route}
                          className="after:absolute after:inset-0 after:rounded-2xl hover:text-accent"
                        >
                          {meta.title}
                        </Link>
                      </h3>
                      <p className="text-[0.9375rem] leading-relaxed text-muted">
                        {meta.description}
                      </p>
                      <p className="mt-auto pt-1 text-sm text-muted">
                        {meta.readingMinutes} min read · Updated{" "}
                        <time dateTime={meta.updated}>{formatIsoDate(meta.updated)}</time>
                      </p>
                    </Card>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Card tone="accent" padding="lg" className="mt-14 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">See every carrier in one place</h2>
          <p className="text-[0.9375rem] text-muted">
            Package Radar collects the alerts your carriers send and answers one
            question: is anything on the way to my home?
          </p>
        </div>
        <Button href="/setup" className="shrink-0">
          Set up your Package Radar
        </Button>
      </Card>
    </Container>
  );
}
