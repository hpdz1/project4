"use client";

import { useEffect, useState } from "react";
import type { DashboardResponse } from "@/lib/types";
import { api, errorMessage, isAbortError, isApiClientError } from "@/lib/client/api";
import { describeVerification, formatRelativeTime, plural } from "@/lib/client/format";
import { Card } from "@/components/ui/Card";
import { DemoSeedButton } from "./DemoSeedButton";
import { VerificationList } from "./VerificationList";

/** How often the setup page checks for forwarded emails while this panel is on screen. */
export const FORWARDING_POLL_MS = 5_000;

export interface ForwardingStatusProps {
  /**
   * Called with every fresh dashboard response (the wizard uses it for its
   * summary). Must be stable (e.g. a state setter): changing it restarts polling.
   */
  onUpdate?: (data: DashboardResponse) => void;
}

function receivedLine(data: DashboardResponse | null, error: string | null): string | null {
  if (error && !data) return error;
  if (!data) return "Checking for forwarded emails…";
  if (data.emailsReceived > 0) {
    const last = data.lastEmailAt ? formatRelativeTime(data.lastEmailAt, data.generatedAt) : null;
    return `We've received ${plural(data.emailsReceived, "email")}${last ? ` (the latest ${last})` : ""}.`;
  }
  if (data.verifications.length > 0) return null;
  return "Waiting for your first forwarded email. This page checks every few seconds.";
}

/** What screen readers hear when something changes (visible text is split up below). */
function announcement(data: DashboardResponse | null, error: string | null): string {
  const parts: string[] = [];
  // Counts only: a relative time here would be re-announced every minute.
  if (data && data.emailsReceived > 0) parts.push(`We've received ${plural(data.emailsReceived, "email")}.`);
  const newest = data?.verifications[0];
  if (newest) parts.push(describeVerification(newest));
  if (error && !data) parts.push(error);
  return parts.join(" ");
}

/**
 * Live panel for setup step 3: polls GET /api/dashboard every 5 seconds while
 * mounted and the tab is visible, and shows forwarding confirmations (Gmail
 * codes and links) and how many emails have arrived.
 */
export function ForwardingStatus({ onUpdate }: ForwardingStatusProps) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped to poll immediately (e.g. right after sending demo emails).
  const [nudge, setNudge] = useState(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    async function poll() {
      if (stopped) return;
      clearTimeout(timer);
      if (document.visibilityState === "visible") {
        controller?.abort();
        controller = new AbortController();
        try {
          const next = await api.getDashboard(controller.signal);
          if (stopped) return;
          setData(next);
          setError(null);
          onUpdate?.(next);
        } catch (e) {
          if (stopped || isAbortError(e)) return;
          setError(
            isApiClientError(e) && e.status === 401
              ? "This device isn't signed in any more. Start again from step 1."
              : errorMessage(e),
          );
        }
      }
      if (!stopped) timer = setTimeout(poll, FORWARDING_POLL_MS);
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void poll();
    }

    void poll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [nudge, onUpdate]);

  const received = data?.emailsReceived ?? 0;
  const line = receivedLine(data, error);

  return (
    <Card as="section" aria-labelledby="forwarding-status-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="relative flex size-3">
          {received === 0 ? (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
          ) : null}
          <span className={`relative inline-flex size-3 rounded-full ${received > 0 ? "bg-success" : "bg-accent"}`} />
        </span>
        <h3 id="forwarding-status-heading" className="font-semibold">
          {received > 0 ? "Forwarding is working" : "Live check"}
        </h3>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement(data, error)}
      </p>
      {line ? (
        <p className={error && !data ? "text-sm font-medium text-danger" : "text-sm leading-relaxed"}>{line}</p>
      ) : null}
      {error && data ? <p className="text-xs text-muted">Couldn&apos;t check just now: {error}</p> : null}

      {data ? <VerificationList verifications={data.verifications} now={data.generatedAt} /> : null}

      {data?.demoMode ? <DemoSeedButton onSeeded={() => setNudge((n) => n + 1)} /> : null}
    </Card>
  );
}
