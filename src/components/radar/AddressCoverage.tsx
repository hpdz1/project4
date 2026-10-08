"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { COUNTRIES, OTHER_COUNTRY_CODE, countryName, parseLocation, type ParsedLocation } from "@/lib/location";
import { getCoverage, type Coverage } from "@/lib/programs";
import { saveLocation } from "@/lib/client/saved-location";
import { locationSummary } from "@/lib/client/setup";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { CoverageView } from "./CoverageView";
import { LockIcon } from "./icons";

interface Result {
  /** What was typed when the user checked. */
  text: string;
  parsed: ParsedLocation;
  coverage: Coverage;
}

export const PRIVACY_NOTE =
  "Your street address stays in this browser — we only use your ZIP to show coverage.";

/**
 * The landing page's address card. Parses the address locally (no network
 * request), shows which carrier programs cover it, and remembers the typed
 * address in this browser so /setup can prefill it.
 */
export function AddressCoverage() {
  const id = useId();
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("US");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // Bumped on every successful check so the heading is focused even when the result looks the same.
  const [checks, setChecks] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (checks > 0) headingRef.current?.focus();
  }, [checks]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = address.trim();
    if (!text && country !== OTHER_COUNTRY_CODE) {
      setError("Enter your address or ZIP code.");
      return;
    }
    const parsed = parseLocation(text, country);
    setError(null);
    setResult({ text, parsed, coverage: getCoverage(parsed.country, parsed.region) });
    setChecks((n) => n + 1);
    saveLocation({
      address: text,
      country: parsed.country,
      postalCode: parsed.postalCode,
      region: parsed.region,
      city: parsed.city,
      savedAt: new Date().toISOString(),
    });
  }

  const inputId = `${id}-address`;
  const countryId = `${id}-country`;
  const errorId = `${id}-error`;
  const noteId = `${id}-note`;

  // "Other" with nothing typed is a valid question; don't nag about a missing address.
  const warnings = result && (result.parsed.country !== OTHER_COUNTRY_CODE || result.text) ? result.parsed.warnings : [];

  const summary = result
    ? result.parsed.country === OTHER_COUNTRY_CODE
      ? "outside the countries we know well"
      : `for ${locationSummary(result.parsed, countryName(result.parsed.country))}`
    : null;

  return (
    <div className="space-y-10">
      <Card padding="lg" className="mx-auto max-w-2xl shadow-md">
        <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-describedby={noteId}>
          <div className="space-y-2">
            <label htmlFor={inputId} className="block text-base font-semibold">
              Your delivery address or ZIP code
            </label>
            {/* No name attribute: nothing is ever submitted to a server, even without JavaScript. */}
            <input
              id={inputId}
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="postal-code"
              spellCheck={false}
              maxLength={300}
              placeholder="e.g. 62701 or 12 Elm St, Springfield, IL 62701"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="block min-h-12 w-full rounded-xl border border-border-strong bg-surface px-4 text-base text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            {error ? (
              <p id={errorId} role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2 sm:flex-1">
              <label htmlFor={countryId} className="block text-sm font-semibold">
                Country
              </label>
              <select
                id={countryId}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="block min-h-12 w-full rounded-xl border border-border-strong bg-surface px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="lg" className="sm:min-w-48">
              Check my coverage
            </Button>
          </div>
          <p id={noteId} className="flex items-start gap-2 text-sm leading-relaxed text-muted">
            <LockIcon className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>{PRIVACY_NOTE}</span>
          </p>
        </form>
      </Card>

      <p className="sr-only" role="status" aria-live="polite">
        {result ? `Showing carrier coverage ${summary}.` : ""}
      </p>
      <div>
        {result ? (
          <section aria-labelledby={`${id}-result`} className="space-y-8">
            <div className="space-y-2">
              <h2
                id={`${id}-result`}
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl font-bold tracking-tight text-balance outline-none sm:text-3xl"
              >
                Carrier coverage {summary}
              </h2>
              <p className="max-w-[65ch] text-[0.9375rem] leading-relaxed text-muted">
                These are the carriers&apos; own free programs. You sign up with each carrier directly; Package Radar
                then collects the alerts they email you into one dashboard.
              </p>
            </div>
            {warnings.length > 0 ? (
              <Callout tone="warning" title="Check your address">
                <ul className="space-y-1">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}
            <CoverageView coverage={result.coverage} idPrefix={`${id}-cov`} />
            <Card tone="accent" padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Put them all in one place</h3>
                <p className="text-[0.9375rem] leading-relaxed text-muted">
                  We&apos;ll walk you through each sign-up and one email filter. No tracking numbers, no carrier
                  passwords.
                </p>
              </div>
              <Button href="/setup" size="lg" className="shrink-0 whitespace-normal! text-center">
                Set up my radar — free, about 10 minutes
              </Button>
            </Card>
          </section>
        ) : null}
      </div>
    </div>
  );
}
