"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { AccountView, DashboardResponse, ProgramId, ProgramState } from "@/lib/types";
import { countryName } from "@/lib/location";
import { getCoverage } from "@/lib/programs";
import { api, errorMessage, isAbortError, isApiClientError } from "@/lib/client/api";
import { browserTimeZone, currentHash, currentOrigin, replaceHash } from "@/lib/client/browser";
import { plural, signInLink } from "@/lib/client/format";
import { loadSavedLocation, saveLocation, type SavedLocation } from "@/lib/client/saved-location";
import {
  SETUP_STEPS,
  checklistProgress,
  checklistPrograms,
  forwardingProgramIds,
  initialStep,
  locationSummary,
  stepIndex,
  withProgramState,
  type SetupStepId,
} from "@/lib/client/setup";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { FilterInstructionsPanel } from "./FilterInstructionsPanel";
import { ForwardingStatus } from "./ForwardingStatus";
import { ProgramChecklistItem } from "./ProgramChecklistItem";
import { SetupAddressStep, type AddressSubmission } from "./SetupAddressStep";
import { SetupProgress } from "./SetupProgress";
import { SignInLinkCallout } from "./SignInLinkCallout";
import { CheckIcon } from "./icons";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready" };

/**
 * The one-time setup wizard: address → carrier programs → forwarding filter
 * → done. Creates the account (or updates it when this device already has
 * one), shows the sign-in key once, and saves the program checklist.
 */
export function SetupWizard() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [reloads, setReloads] = useState(0);
  const [account, setAccount] = useState<AccountView | null>(null);
  const [saved, setSaved] = useState<SavedLocation | null>(null);
  const [step, setStep] = useState<SetupStepId>("address");
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [programError, setProgramError] = useState<string | null>(null);
  const [latest, setLatest] = useState<DashboardResponse | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const calloutRef = useRef<HTMLDivElement>(null);
  const focusHeading = useRef(false);
  const focusCallout = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const local = loadSavedLocation();
    (async () => {
      let found: AccountView | null = null;
      try {
        found = (await api.getAccount(controller.signal)).account;
      } catch (e) {
        if (isAbortError(e)) return;
        // 401: no session on this device; 404: the session's account is gone.
        if (!(isApiClientError(e) && (e.status === 401 || e.status === 404))) {
          setLoad({ status: "error", message: errorMessage(e) });
          return;
        }
      }
      setSaved(local);
      setAccount(found);
      setStep(initialStep(found !== null, currentHash()));
      setLoad({ status: "ready" });
    })();
    return () => controller.abort();
  }, [reloads]);

  useEffect(() => {
    if (focusCallout.current && createdLink) {
      focusCallout.current = false;
      calloutRef.current?.focus();
      return;
    }
    if (focusHeading.current) {
      focusHeading.current = false;
      headingRef.current?.focus();
    }
  }, [step, createdLink]);

  const goTo = useCallback((next: SetupStepId) => {
    focusHeading.current = true;
    setStep(next);
    setSaveError(null);
    // The sign-in link is shown once: leaving the address step forgets it.
    if (next !== "address") setCreatedLink(null);
    replaceHash(next);
  }, []);

  async function submitAddress({ address, parsed, location }: AddressSubmission) {
    setBusy(true);
    setSaveError(null);
    saveLocation({
      address,
      country: location.country,
      postalCode: location.postalCode,
      region: location.region,
      city: parsed.city,
      savedAt: new Date().toISOString(),
    });
    const timezone = browserTimeZone();
    try {
      if (account) {
        const res = await api.updateAccount({ ...location, timezone });
        setAccount(res.account);
        goTo("carriers");
      } else {
        const res = await api.createAccount({ ...location, timezone });
        setAccount(res.account);
        focusCallout.current = true;
        setCreatedLink(signInLink(currentOrigin(), res.accountKey));
        replaceHash("address");
      }
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function setProgram(id: ProgramId, state: ProgramState | null) {
    if (!account) return;
    const previous = account.programs[id] ?? null;
    // Optimistic and per program, so quick clicks on several programs don't undo each other.
    setAccount((cur) => (cur ? { ...cur, programs: withProgramState(cur.programs, id, state) } : cur));
    setProgramError(null);
    try {
      const res = await api.updateAccount({ programs: { [id]: state } });
      // The checklist on screen is the newest truth; take everything else from the server.
      setAccount((cur) => (cur ? { ...res.account, programs: cur.programs } : res.account));
    } catch (e) {
      setAccount((cur) => (cur ? { ...cur, programs: withProgramState(cur.programs, id, previous) } : cur));
      setProgramError(`Couldn't save that: ${errorMessage(e)}`);
    }
  }

  if (load.status === "loading") {
    return (
      <div role="status" className="space-y-4" aria-label="Loading your setup">
        <div className="h-10 w-2/3 animate-pulse rounded-xl bg-subtle motion-reduce:animate-none" />
        <div className="h-48 animate-pulse rounded-2xl bg-subtle motion-reduce:animate-none" />
      </div>
    );
  }

  if (load.status === "error") {
    return (
      <Callout tone="danger" title="We couldn't load your setup" role="alert">
        <p>{load.message}</p>
        <Button variant="secondary" size="sm" onClick={() => {
          setLoad({ status: "loading" });
          setReloads((n) => n + 1);
        }}>
          Try again
        </Button>
      </Callout>
    );
  }

  const meta = SETUP_STEPS[stepIndex(step)];
  const coverage = account ? getCoverage(account.country, account.region) : null;
  const programs = coverage ? checklistPrograms(coverage) : [];
  const progress = account ? checklistProgress(programs, account.programs) : null;

  return (
    <div className="space-y-8">
      <SetupProgress
        current={step}
        canVisit={() => account !== null}
        onSelect={goTo}
      />

      <section aria-labelledby="setup-step-heading" className="space-y-6">
        <h2
          id="setup-step-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold tracking-tight outline-none sm:text-3xl"
        >
          {meta.title}
        </h2>

        {step === "address" ? (
          account && createdLink ? (
            <div className="space-y-6">
              <p className="flex items-center gap-2 text-[0.9375rem]">
                <CheckIcon className="size-5 text-success" />
                <span>
                  Your radar is ready for{" "}
                  <strong>{locationSummary(account, countryName(account.country))}</strong>.
                </span>
              </p>
              <SignInLinkCallout ref={calloutRef} link={createdLink} />
              <Button size="lg" onClick={() => goTo("carriers")} className="w-full sm:w-auto">
                I&apos;ve saved it — continue
              </Button>
            </div>
          ) : (
            <>
              <p className="max-w-[65ch] leading-relaxed text-muted">
                We use your ZIP or postcode to work out which carriers&apos; free programs cover your home. Nothing is
                looked up anywhere: your street address never leaves this browser.
              </p>
              <SetupAddressStep
                initialAddress={saved?.address ?? account?.postalCode ?? ""}
                initialCountry={saved?.country ?? account?.country ?? "US"}
                hasAccount={account !== null}
                busy={busy}
                error={saveError}
                onSubmit={submitAddress}
              />
            </>
          )
        ) : null}

        {step === "carriers" && account && coverage && progress ? (
          <div className="space-y-6">
            <p className="max-w-[65ch] leading-relaxed text-muted">
              Sign up for each program on the carrier&apos;s own website, then make sure its email alerts are on. Package
              Radar never sees your carrier passwords.
            </p>
            <Callout tone="info" title="Some carriers mail you a code">
              <p>
                To prove you live there, some programs send a code by post, which can take a few days to a couple of
                weeks. You don&apos;t have to wait: carry on with the forwarding step now and come back to tick them off
                later.
              </p>
            </Callout>
            <p className="text-sm font-semibold" aria-live="polite">
              {progress.done} of {progress.total} done
              {progress.skipped ? ` · ${progress.skipped} skipped` : ""}
            </p>
            {programError ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {programError}
              </p>
            ) : null}
            <ul className="space-y-5">
              {programs.map((p) => (
                <ProgramChecklistItem
                  key={p.id}
                  program={p}
                  state={account.programs[p.id]}
                  onChange={(state) => void setProgram(p.id, state)}
                />
              ))}
            </ul>
            {coverage.perPackage.length > 0 || coverage.gaps.length > 0 ? (
              <details className="rounded-2xl border border-border bg-surface px-4 py-3 sm:px-6">
                <summary className="cursor-pointer py-1 font-semibold">What these programs won&apos;t cover</summary>
                <div className="mt-3 space-y-3 text-[0.9375rem] leading-relaxed">
                  {coverage.perPackage.map((p) => (
                    <p key={p.id}>
                      <strong>{p.name}:</strong> {p.shows}
                    </p>
                  ))}
                  <ul className="list-disc space-y-1.5 pl-5 text-muted marker:text-border-strong">
                    {coverage.gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              </details>
            ) : null}
            <StepNav onBack={() => goTo("address")} onNext={() => goTo("forward")} />
          </div>
        ) : null}

        {step === "forward" && account && coverage ? (
          <div className="space-y-6">
            <p className="max-w-[65ch] leading-relaxed text-muted">
              Add one rule in your email so the carriers&apos; alerts are forwarded to your private Package Radar
              address. Only those senders are forwarded; the rest of your mail stays put.
            </p>
            <Card tone="accent" className="space-y-3">
              <p className="text-sm font-semibold">Your Package Radar forwarding address</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-base break-all">
                  {account.inboundAddress}
                </code>
                <CopyButton text={account.inboundAddress} label="Copy address" aria-label="Copy address: your forwarding address" />
              </div>
              <p className="text-sm leading-relaxed text-muted">
                It only lets mail in. Anyone who knows it could send you fake alerts, so don&apos;t post it publicly.
              </p>
            </Card>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <div className="lg:sticky lg:top-6 lg:order-2">
                <ForwardingStatus onUpdate={setLatest} />
              </div>
              <div className="lg:order-1">
                <FilterInstructionsPanel
                  inboundAddress={account.inboundAddress}
                  programIds={forwardingProgramIds(coverage, account.programs)}
                  country={account.country}
                />
              </div>
            </div>
            <StepNav onBack={() => goTo("carriers")} onNext={() => goTo("done")} nextLabel="I've set up forwarding" />
          </div>
        ) : null}

        {step === "done" && account && progress ? (
          <div className="space-y-6">
            <ul className="space-y-3">
              <SummaryRow ok title="Address saved">
                {locationSummary(account, countryName(account.country))}. Your street address stayed in this browser.
              </SummaryRow>
              <SummaryRow ok={progress.done > 0} title="Carrier alerts">
                {progress.done > 0
                  ? `${progress.done} of ${progress.total} programs turned on${
                      progress.todo > 0 ? `; ${progress.todo} still to do — come back any time` : ""
                    }.`
                  : "None marked as done yet. Packages show up once at least one carrier emails you."}
              </SummaryRow>
              <SummaryRow ok={(latest?.emailsReceived ?? 0) > 0} title="Forwarding">
                {(latest?.emailsReceived ?? 0) > 0
                  ? `Working — we've received ${plural(latest?.emailsReceived ?? 0, "email")}.`
                  : "No forwarded emails yet. That's normal until a carrier has news; Gmail users need to confirm forwarding first."}
              </SummaryRow>
            </ul>
            <p className="max-w-[65ch] leading-relaxed text-muted">
              From now on, each carrier alert is read as it arrives and your dashboard answers one question: is anything
              on the way to your home? Keep your sign-in link somewhere safe to open it on other devices.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button href="/dashboard" size="lg">
                Open my dashboard
              </Button>
              <Button variant="ghost" size="lg" onClick={() => goTo("forward")}>
                Back to forwarding
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function StepNav({ onBack, onNext, nextLabel = "Continue" }: { onBack: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
      <Button variant="ghost" onClick={onBack}>
        Back
      </Button>
      <Button size="lg" onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  );
}

function SummaryRow({ ok, title, children }: { ok: boolean; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
          ok ? "bg-success text-surface" : "bg-subtle text-muted"
        }`}
      >
        {ok ? <CheckIcon /> : <span className="size-2 rounded-full bg-border-strong" />}
      </span>
      <div>
        <p className="font-semibold">
          {title}
          <span className="sr-only">{ok ? " (done)" : " (not yet)"}</span>
        </p>
        <p className="text-[0.9375rem] leading-relaxed text-muted">{children}</p>
      </div>
    </li>
  );
}
