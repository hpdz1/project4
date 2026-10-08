import Link from "next/link";
import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { GUIDES, getGuide } from "@/content/guides";
import { AdSlot } from "@/components/ads/AdSlot";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { JsonLd } from "@/components/site/JsonLd";
import {
  formatIsoDate,
  guideJsonLd,
  relatedGuides,
} from "@/components/site/guides";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { AD_SLOTS, SITE_URL, pageMetadata } from "@/lib/site";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

/** Only the guides that exist; any other slug is a 404. */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return GUIDES.map((guide) => ({ slug: guide.meta.slug }));
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  const { meta } = guide;
  return pageMetadata({
    title: meta.title,
    description: meta.description,
    path: `/guides/${meta.slug}`,
    article: { publishedTime: meta.published, modifiedTime: meta.updated },
  });
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const { meta, Content } = guide;
  const related = relatedGuides(
    meta,
    GUIDES.map((g) => g.meta),
  );

  return (
    <Container size="narrow" className="py-8 sm:py-12">
      <JsonLd data={guideJsonLd(meta, SITE_URL)} />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Guides", href: "/guides" },
          { label: meta.title },
        ]}
      />
      <PageHeader eyebrow={meta.category} title={meta.title} description={meta.description}>
        <p className="text-sm text-muted">
          Last updated{" "}
          <time dateTime={meta.updated}>{formatIsoDate(meta.updated)}</time>
          {" · "}
          {meta.readingMinutes} min read
        </p>
      </PageHeader>

      <article className="article">
        <Content />
      </article>

      <AdSlot slot={AD_SLOTS.guide} />

      {related.length > 0 ? (
        <section aria-labelledby="related-guides" className="mt-14">
          <h2 id="related-guides" className="mb-4 text-xl font-bold tracking-tight">
            Related guides
          </h2>
          <ul className="space-y-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/guides/${r.slug}` as Route}
                  className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/50"
                >
                  <span className="block font-semibold text-text">{r.title}</span>
                  <span className="mt-1 block text-[0.9375rem] text-muted">
                    {r.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Card tone="accent" padding="lg" className="mt-12 space-y-3">
        <h2 className="text-lg font-semibold">Set up your Package Radar</h2>
        <p className="text-[0.9375rem] leading-relaxed text-muted">
          Turn on your carriers&apos; free delivery alerts once, forward them to
          your personal Package Radar address, and see everything headed to your
          home on one page. No tracking numbers, no carrier passwords.
        </p>
        <Button href="/setup">Start setup</Button>
      </Card>
    </Container>
  );
}
