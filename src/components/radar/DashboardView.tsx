"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { DashboardResponse, DashboardShipment, UpdateShipmentRequest } from "@/lib/types";
import { AD_SLOTS } from "@/lib/site";
import { api, errorMessage, isAbortError, isApiClientError } from "@/lib/client/api";
import { groupShipments, shipmentTitle, visibleFeeds } from "@/lib/client/format";
import { AdSlot } from "@/components/ads/AdSlot";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { AnswerCard } from "./AnswerCard";
import { DemoSeedButton } from "./DemoSeedButton";
import { FeedHealthList } from "./FeedHealthList";
import { SettingsPanel } from "./SettingsPanel";
import { ShipmentCard } from "./ShipmentCard";
import { VerificationList } from "./VerificationList";
import { RadarIcon } from "./icons";

/** Background refresh interval while the tab is visible. */
export const DASHBOARD_REFRESH_MS = 60_000;
/** Ignore focus events this soon after the last fetch. */
const FOCUS_REFRESH_MIN_MS = 10_000;

type ViewState =
  | { kind: "loading" }
  | { kind: "signed_out"; reason: "none" | "signed_out" }
  | { kind: "deleted" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: DashboardResponse };

interface Notice {
  text: string;
  tone: "info" | "error";
  undo?: { id: string; change: UpdateShipmentRequest };
}

/**
 * The dashboard: one answer to "is anything on the way to my home?", the
 * shipments grouped by urgency, feed health and settings. Fetches
 * GET /api/dashboard on load, every 60 seconds and when the window regains focus.
 */
export function DashboardView() {
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Bumping this re-runs the fetch effect (manual refresh, after an update, after demo emails).
  const [reloadKey, setReloadKey] = useState(0);
  const lastFetchRef = useRef(0);
  const noticeRef = useRef<HTMLDivElement>(null);
  const focusNotice = useRef(false);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | undefined;

    async function fetchDashboard() {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      lastFetchRef.current = Date.now();
      try {
        const data = await api.getDashboard(current.signal);
        if (cancelled) return;
        setView({ kind: "ready", data });
        setRefreshError(null);
      } catch (e) {
        if (cancelled || isAbortError(e)) return;
        if (isApiClientError(e) && e.status === 401) {
          setView({ kind: "signed_out", reason: "none" });
          return;
        }
        const message = errorMessage(e);
        // Keep showing what we have; only an empty page turns into an error screen.
        setView((prev) => (prev.kind === "ready" ? prev : { kind: "error", message }));
        setRefreshError(message);
      } finally {
        if (!cancelled && controller === current) setRefreshing(false);
      }
    }

    void fetchDashboard();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void fetchDashboard();
    }, DASHBOARD_REFRESH_MS);
    function onFocus() {
      if (Date.now() - lastFetchRef.current >= FOCUS_REFRESH_MIN_MS) void fetchDashboard();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") onFocus();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      controller?.abort();
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reloadKey]);

  useEffect(() => {
    if (focusNotice.current && notice) {
      focusNotice.current = false;
      noticeRef.current?.focus();
    }
  }, [notice]);

  function refreshNow() {
    setRefreshing(true);
    reload();
  }

  async function updateShipment(
    shipment: DashboardShipment,
    change: UpdateShipmentRequest,
    done: string,
    undo?: UpdateShipmentRequest,
  ) {
    setPending(shipment.id);
    try {
      await api.updateShipment(shipment.id, change);
      focusNotice.current = true;
      setNotice({ text: done, tone: "info", undo: undo ? { id: shipment.id, change: undo } : undefined });
      reload();
    } catch (e) {
      focusNotice.current = true;
      setNotice({ text: `Couldn't update “${shipmentTitle(shipment)}”: ${errorMessage(e)}`, tone: "error" });
    } finally {
      setPending(null);
    }
  }

  async function undoLast() {
    const undo = notice?.undo;
    if (!undo) return;
    setPending(undo.id);
    try {
      await api.updateShipment(undo.id, undo.change);
      // The Undo button goes away, so keep keyboard focus on the message.
      focusNotice.current = true;
      setNotice({ text: "Undone.", tone: "info" });
      reload();
    } catch (e) {
      focusNotice.current = true;
      setNotice({ text: `Couldn't undo: ${errorMessage(e)}`, tone: "error" });
    } finally {
      setPending(null);
    }
  }

  if (view.kind === "loading") {
    return (
      <div role="status" aria-label="Loading your radar" className="space-y-6">
        <div className="h-52 animate-pulse rounded-3xl bg-subtle motion-reduce:animate-none" />
        <div className="h-28 animate-pulse rounded-2xl bg-subtle motion-reduce:animate-none" />
        <div className="h-28 animate-pulse rounded-2xl bg-subtle motion-reduce:animate-none" />
      </div>
    );
  }

  if (view.kind === "signed_out") {
    return (
      <EmptyState
        title={view.reason === "signed_out" ? "You're signed out" : "No radar on this device"}
        actions={
          <>
            <Button href="/setup" size="lg">
              Set up my radar
            </Button>
            <Button href="/signin" variant="secondary" size="lg">
              Sign in with my link
            </Button>
          </>
        }
      >
        {view.reason === "signed_out"
          ? "This device is signed out. Your radar keeps collecting your carriers' alerts; open your personal sign-in link to see it again."
          : "Set up a radar in about 10 minutes, or, if you already have one, open your personal sign-in link on this device."}
      </EmptyState>
    );
  }

  if (view.kind === "deleted") {
    return (
      <EmptyState
        title="Your data has been deleted"
        actions={
          <Button href="/" variant="secondary" size="lg">
            Back to the home page
          </Button>
        }
      >
        Your radar, forwarding address and shipments are gone, and this browser has forgotten your address. Remember to
        remove the forwarding filter or rule from your email.
      </EmptyState>
    );
  }

  if (view.kind === "error") {
    return (
      <Callout tone="danger" title="We couldn't load your radar" role="alert">
        <p>{view.message}</p>
        <Button variant="secondary" size="sm" onClick={refreshNow} loading={refreshing}>
          Try again
        </Button>
      </Callout>
    );
  }

  const { data } = view;
  const groups = groupShipments(data.shipments);
  const hasEmails = data.emailsReceived > 0;
  const { postalCode, region, country } = data.account;
  const area = [postalCode ? (country === "US" ? `ZIP ${postalCode}` : postalCode) : null, region]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-10">
      <AnswerCard
        answer={data.answer}
        emailsReceived={data.emailsReceived}
        lastEmailAt={data.lastEmailAt}
        generatedAt={data.generatedAt}
        eyebrow={area ? `My radar · ${area}` : "My radar"}
        onRefresh={refreshNow}
        refreshing={refreshing}
      />

      {refreshError ? (
        <p role="status" className="text-sm text-warning">
          Couldn&apos;t refresh just now ({refreshError}). Showing what we had.
        </p>
      ) : null}

      {data.verifications.length > 0 ? (
        <section aria-label="Forwarding confirmations" className="space-y-3">
          <VerificationList verifications={data.verifications} now={data.generatedAt} />
        </section>
      ) : null}

      <div
        ref={noticeRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="rounded-xl outline-none empty:hidden"
      >
        {notice ? (
          <div
            className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-[0.9375rem] ${
              notice.tone === "error" ? "border-danger/30 bg-danger-soft" : "border-border bg-subtle"
            }`}
          >
            <span className="min-w-0 flex-1">{notice.text}</span>
            {notice.undo ? (
              <Button variant="ghost" size="sm" onClick={undoLast} disabled={pending !== null}>
                Undo
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => setNotice(null)} aria-label="Dismiss message">
              Dismiss
            </Button>
          </div>
        ) : null}
      </div>

      {!hasEmails ? (
        <Card padding="lg" className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <RadarIcon />
            </span>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">No carrier emails yet</h2>
              <p className="leading-relaxed text-muted">
                Packages appear here once your carriers&apos; alerts are forwarded to{" "}
                <span className="font-mono text-text break-all">{data.account.inboundAddress}</span>.
                If you&apos;ve just set up forwarding, the first email can take a while: carriers only write when they
                have news, and Gmail asks you to confirm forwarding first.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="/setup#forward">Finish setting up forwarding</Button>
          </div>
          {data.demoMode ? <DemoSeedButton onSeeded={reload} /> : null}
        </Card>
      ) : groups.length === 0 ? (
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold">No packages to show</h2>
          <p className="leading-relaxed text-muted">
            None of the emails we&apos;ve received mention a package that&apos;s still on its way. New ones show up
            here as soon as a carrier writes about them.
          </p>
        </Card>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.group} aria-labelledby={`group-${group.group}`} className="space-y-4">
              <h2 id={`group-${group.group}`} className="flex items-baseline gap-2 text-xl font-bold tracking-tight">
                {group.label}
                <span className="text-base font-semibold text-muted">({group.shipments.length})</span>
              </h2>
              <ul className="space-y-3">
                {group.shipments.map((s) => {
                  const title = shipmentTitle(s);
                  const busy = pending === s.id;
                  return (
                    <ShipmentCard
                      key={s.id}
                      shipment={s}
                      actions={
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            aria-label={`Not mine: ${title}`}
                            onClick={() =>
                              void updateShipment(s, { hidden: true }, `Hidden “${title}”.`, { hidden: false })
                            }
                          >
                            Not mine
                          </Button>
                          {s.group !== "delivered_recently" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              aria-label={`Got it: ${title}`}
                              onClick={() =>
                                void updateShipment(s, { delivered: true }, `Marked “${title}” as received.`, {
                                  delivered: false,
                                })
                              }
                            >
                              Got it
                            </Button>
                          ) : null}
                        </>
                      }
                    />
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section aria-labelledby="feeds-heading" className="space-y-4">
        <div className="space-y-1">
          <h2 id="feeds-heading" className="text-xl font-bold tracking-tight">
            Carrier feeds
          </h2>
          <p className="text-[0.9375rem] text-muted">When we last heard from each carrier, and anything that looks off.</p>
        </div>
        <FeedHealthList feeds={visibleFeeds(data.feeds, data.account.country)} now={data.generatedAt} />
      </section>

      {/* Only with real content (never on the empty states), below the lists and well away from the action buttons. */}
      {hasEmails && groups.length > 0 ? (
        <div className="py-4">
          <AdSlot slot={AD_SLOTS.dashboard} />
        </div>
      ) : null}

      <SettingsPanel
        account={data.account}
        onSignedOut={() => setView({ kind: "signed_out", reason: "signed_out" })}
        onDeleted={() => setView({ kind: "deleted" })}
      />
    </div>
  );
}

function EmptyState({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <Card padding="lg" className="mx-auto max-w-2xl space-y-5 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <RadarIcon className="size-6" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="leading-relaxed text-muted">{children}</p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">{actions}</div>
    </Card>
  );
}
