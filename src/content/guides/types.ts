import type { JSX } from "react";

/** Where a guide is listed on /guides. */
export type GuideCategory = "Getting started" | "Carriers" | "Safety" | "Troubleshooting";

export interface GuideMeta {
  /** URL slug; matches the article's file name (`<slug>.tsx`). */
  slug: string;
  title: string;
  /** Meta description and index-card summary. At most 160 characters. */
  description: string;
  /** YYYY-MM-DD. */
  published: string;
  /** YYYY-MM-DD. Change only when the content materially changes. */
  updated: string;
  readingMinutes: number;
  category: GuideCategory;
}

export interface Guide {
  meta: GuideMeta;
  /** The article body: semantic HTML only, no <h1> (the page renders the title). */
  Content: () => JSX.Element;
}
