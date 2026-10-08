"use client";

import { useId, useState, type FormEvent } from "react";
import { COUNTRIES, OTHER_COUNTRY_CODE, countryName, parseLocation, type ParsedLocation } from "@/lib/location";
import { checkAddress, locationSummary } from "@/lib/client/setup";
import { Button } from "@/components/ui/Button";
import { LockIcon } from "./icons";

export interface AddressSubmission {
  /** What the user typed; stays in this browser. */
  address: string;
  parsed: ParsedLocation;
  /** What the server gets. */
  location: { country: string; postalCode: string | null; region: string | null };
}

export interface SetupAddressStepProps {
  initialAddress: string;
  initialCountry: string;
  hasAccount: boolean;
  busy: boolean;
  /** Error from saving (shown under the form). */
  error: string | null;
  onSubmit: (value: AddressSubmission) => void;
}

const FIELD =
  "block min-h-12 w-full rounded-xl border border-border-strong bg-surface px-4 text-base text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Step 1: country + address/ZIP, parsed in the browser; only country, ZIP and state are sent. */
export function SetupAddressStep({
  initialAddress,
  initialCountry,
  hasAccount,
  busy,
  error,
  onSubmit,
}: SetupAddressStepProps) {
  const id = useId();
  const [address, setAddress] = useState(initialAddress);
  const [country, setCountry] = useState(initialCountry);
  const [problem, setProblem] = useState<string | null>(null);

  const text = address.trim();
  const preview = text || country === OTHER_COUNTRY_CODE ? parseLocation(text, country) : null;
  const previewCheck = preview ? checkAddress(preview, OTHER_COUNTRY_CODE) : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text && country !== OTHER_COUNTRY_CODE) {
      setProblem("Enter your address or ZIP code.");
      return;
    }
    const parsed = parseLocation(text, country);
    const check = checkAddress(parsed, OTHER_COUNTRY_CODE);
    if (!check.ok) {
      setProblem(check.message);
      return;
    }
    setProblem(null);
    onSubmit({
      address: text,
      parsed,
      location: { country: check.country, postalCode: check.postalCode, region: check.region },
    });
  }

  const inputId = `${id}-address`;
  const problemId = `${id}-problem`;
  const previewId = `${id}-preview`;
  const shownError = problem ?? error;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {hasAccount ? (
        <p className="rounded-xl bg-subtle px-4 py-3 text-[0.9375rem] leading-relaxed">
          This device already has a radar. Changing your address here updates it; your forwarding address stays the
          same.
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor={`${id}-country`} className="block text-sm font-semibold">
          Country
        </label>
        <select
          id={`${id}-country`}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className={`${FIELD} px-3 sm:max-w-xs`}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor={inputId} className="block text-sm font-semibold">
          Your delivery address or ZIP code
          {country === OTHER_COUNTRY_CODE ? <span className="font-normal text-muted"> (optional)</span> : null}
        </label>
        <input
          id={inputId}
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="postal-code"
          spellCheck={false}
          maxLength={300}
          placeholder="e.g. 62701 or 12 Elm St, Springfield, IL 62701"
          aria-invalid={shownError ? true : undefined}
          aria-describedby={[shownError ? problemId : null, previewId].filter(Boolean).join(" ")}
          className={FIELD}
        />
        {shownError ? (
          <p id={problemId} role="alert" className="text-sm font-medium text-danger">
            {shownError}
          </p>
        ) : null}
        <p id={previewId} className="flex items-start gap-2 text-sm leading-relaxed text-muted">
          <LockIcon className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>
            {preview && previewCheck?.ok
              ? `We'll save only: ${locationSummary(previewCheck, countryName(previewCheck.country))}. `
              : null}
            Your street address stays in this browser — we only use your ZIP to show coverage.
          </span>
        </p>
      </div>

      <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
        {hasAccount ? "Save and continue" : "Create my radar"}
      </Button>
    </form>
  );
}
