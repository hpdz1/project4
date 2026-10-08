import type { DashboardResponse } from "@/lib/types";
import { formatClockTime, formatRelativeTime } from "@/lib/client/format";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { RefreshIcon } from "./icons";

export interface AnswerCardProps {
  answer: DashboardResponse["answer"];
  emailsReceived: number;
  lastEmailAt: string | null;
  /** Server time of the response; relative times are measured from it. */
  generatedAt: string;
  /** Small label above the answer, e.g. "ZIP 60614 · IL". */
  eyebrow?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  headingId?: string;
}

type CountKey = "arrivingToday" | "onTheWay" | "needsAttention" | "deliveredRecently";

const TILES: { key: CountKey; label: string }[] = [
  { key: "arrivingToday", label: "Arriving today" },
  { key: "onTheWay", label: "On the way" },
  { key: "needsAttention", label: "Needs attention" },
  { key: "deliveredRecently", label: "Delivered recently" },
];

/** The big answer at the top of the dashboard: the headline, counts and freshness. */
export function AnswerCard({
  answer,
  emailsReceived,
  lastEmailAt,
  generatedAt,
  eyebrow,
  onRefresh,
  refreshing = false,
  headingId = "answer-heading",
}: AnswerCardProps) {
  const lastEmail = lastEmailAt ? formatRelativeTime(lastEmailAt, generatedAt) : null;
  const updated = formatClockTime(generatedAt);

  return (
    <section
      aria-labelledby={headingId}
      className={cx(
        "rounded-3xl border p-5 shadow-sm sm:p-8",
        answer.anythingComing ? "border-accent/30 bg-accent-soft" : "border-border bg-surface",
      )}
    >
      {eyebrow ? (
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">{eyebrow}</p>
      ) : null}
      <h1 id={headingId} className="mt-2 text-2xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
        {answer.headline}
      </h1>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TILES.map((tile) => {
          const value = answer[tile.key];
          const highlight = tile.key === "needsAttention" && value > 0;
          return (
            <div
              key={tile.key}
              className={cx(
                "rounded-2xl border bg-surface px-4 py-3",
                highlight ? "border-warning/40" : "border-border",
              )}
            >
              <dt className="text-sm text-muted">{tile.label}</dt>
              <dd className={cx("text-2xl font-bold tabular-nums", highlight && "text-warning")}>{value}</dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-5 flex flex-col gap-2 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          {lastEmail
            ? `Last carrier email: ${lastEmail} · ${emailsReceived} received so far`
            : "No carrier emails yet."}
        </p>
        <div className="flex items-center gap-2">
          {updated ? (
            <p>
              Updated <time dateTime={generatedAt}>{updated}</time>
            </p>
          ) : null}
          {onRefresh ? (
            <Button variant="ghost" size="sm" onClick={onRefresh} loading={refreshing}>
              {refreshing ? null : <RefreshIcon />}
              Refresh
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
