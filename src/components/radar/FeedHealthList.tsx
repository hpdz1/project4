import type { FeedHealth } from "@/lib/types";
import { SOURCE_LABELS, formatRelativeTime } from "@/lib/client/format";
import { Badge, type Tone } from "@/components/ui/Badge";

const STATE: Record<FeedHealth["state"], { label: string; tone: Tone }> = {
  ok: { label: "Working", tone: "success" },
  quiet: { label: "Quiet", tone: "warning" },
  never: { label: "Not seen yet", tone: "neutral" },
};

/** Per-carrier feed status: when we last heard from each source, with a hint when something looks off. */
export function FeedHealthList({ feeds, now }: { feeds: readonly FeedHealth[]; now: string }) {
  if (feeds.length === 0) return null;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {feeds.map((feed) => {
        const state = STATE[feed.state] ?? STATE.never;
        const seen = feed.lastSeenAt ? formatRelativeTime(feed.lastSeenAt, now) : null;
        return (
          <li key={feed.source} className="flex flex-col gap-1.5 p-4 sm:flex-row sm:items-start sm:gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold">{SOURCE_LABELS[feed.source] ?? feed.source}</p>
              {feed.hint ? <p className="text-sm leading-relaxed text-muted">{feed.hint}</p> : null}
            </div>
            <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
              <Badge tone={state.tone}>{state.label}</Badge>
              {seen ? <p className="text-xs text-muted">Last email {seen}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
