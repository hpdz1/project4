import Link from "next/link";
import type { Route } from "next";
import type { Coverage, Program } from "@/lib/programs";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export interface CoverageViewProps {
  coverage: Coverage;
  /** id of the heading of the first group, for aria-labelledby on the parent. */
  idPrefix?: string;
}

function costTone(cost: string): "success" | "neutral" {
  return /^free/i.test(cost) ? "success" : "neutral";
}

/** One program's summary: what it shows, what it costs, how it checks you live there. */
export function ProgramSummary({ program, headingLevel = 4 }: { program: Program; headingLevel?: 3 | 4 }) {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  return (
    <Card as="li" padding="sm" className="flex flex-col gap-3 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Heading className="text-base leading-snug font-semibold">{program.name}</Heading>
        <Badge tone={costTone(program.cost)}>{/^free/i.test(program.cost) ? "Free" : "Paid"}</Badge>
      </div>
      <p className="text-[0.9375rem] leading-relaxed">{program.shows}</p>
      <dl className="space-y-2 text-sm leading-relaxed text-muted">
        <div>
          <dt className="font-semibold text-text">Cost</dt>
          <dd>{program.cost}</dd>
        </div>
        <div>
          <dt className="font-semibold text-text">
            {program.kind === "account" ? "What you need" : "How they check it\u2019s your home"}
          </dt>
          <dd>{program.verification}</dd>
        </div>
        <div>
          <dt className="font-semibold text-text">Time to set up</dt>
          <dd>{program.setupTime}</dd>
        </div>
      </dl>
      {program.guideSlug ? (
        <p className="mt-auto pt-1 text-sm">
          <Link
            href={`/guides/${program.guideSlug}` as Route}
            className="font-medium text-accent underline underline-offset-4 hover:no-underline"
          >
            Our {program.name} guide
          </Link>
        </p>
      ) : null}
    </Card>
  );
}

/**
 * Which carrier programs cover an address, grouped by how much they can see,
 * plus the honest blind spots. Pure presentation (no hooks).
 */
export function CoverageView({ coverage, idPrefix = "coverage" }: CoverageViewProps) {
  const { addressPrograms, accountPrograms, perPackage, gaps } = coverage;
  return (
    <div className="space-y-10">
      {addressPrograms.length > 0 ? (
        <section aria-labelledby={`${idPrefix}-address`} className="space-y-4">
          <div className="space-y-1">
            <h3 id={`${idPrefix}-address`} className="text-lg font-semibold">
              Shows everything addressed to your home
            </h3>
            <p className="text-[0.9375rem] text-muted">
              Once a carrier confirms you live there, it emails you about its packages headed your way, including ones
              you didn&apos;t order.
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            {addressPrograms.map((p) => (
              <ProgramSummary key={p.id} program={p} />
            ))}
          </ul>
        </section>
      ) : null}

      {accountPrograms.length > 0 ? (
        <section aria-labelledby={`${idPrefix}-account`} className="space-y-4">
          <div className="space-y-1">
            <h3 id={`${idPrefix}-account`} className="text-lg font-semibold">
              Shows your own orders
            </h3>
            <p className="text-[0.9375rem] text-muted">
              Tied to your shopping or carrier account, not your address.
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {accountPrograms.map((p) => (
              <ProgramSummary key={p.id} program={p} />
            ))}
          </ul>
        </section>
      ) : null}

      {perPackage.length > 0 ? (
        <section aria-labelledby={`${idPrefix}-per-package`} className="space-y-3">
          <h3 id={`${idPrefix}-per-package`} className="text-lg font-semibold">
            One package at a time
          </h3>
          <ul className="space-y-3">
            {perPackage.map((p) => (
              <li key={p.id} className="rounded-xl border border-border bg-surface p-4 text-[0.9375rem] leading-relaxed">
                <span className="font-semibold">{p.name}.</span> {p.shows}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {gaps.length > 0 ? (
        <section aria-labelledby={`${idPrefix}-gaps`} className="space-y-3">
          <h3 id={`${idPrefix}-gaps`} className="text-lg font-semibold">
            What no program will show
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed text-muted marker:text-border-strong">
            {gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
