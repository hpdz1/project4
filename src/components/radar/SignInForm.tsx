"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api, errorMessage, isApiClientError } from "@/lib/client/api";
import { currentHash, replaceHash } from "@/lib/client/browser";
import { accountKeyFromInput, keyFromHash } from "@/lib/client/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function signInError(error: unknown): string {
  if (isApiClientError(error) && [400, 401, 403, 404, 422].includes(error.status)) {
    return "That sign-in link didn't work. Check that you copied all of it. If you've made a new link since, only the newest one works.";
  }
  return errorMessage(error);
}

/**
 * Sign in on this device with a personal sign-in link or key. A key in the
 * URL fragment (#key=…) is read in the browser — fragments never reach the
 * server — removed from the address bar straight away, and posted to
 * /api/session in the request body.
 */
export function SignInForm() {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromLink, setFromLink] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const signIn = useCallback(
    async (key: string) => {
      try {
        await api.signIn(key);
        replaceHash(null);
        router.push("/dashboard");
      } catch (e) {
        setError(signInError(e));
        setBusy(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const hash = currentHash();
    if (!hash) return;
    const key = keyFromHash(hash);
    // Get the secret out of the address bar (and history) before anything else.
    replaceHash(null);
    if (!key) return;
    // The fragment is gone after the first run, so this happens once even
    // when effects run twice (StrictMode). State updates go in a callback:
    // the effect only starts the work.
    queueMicrotask(() => {
      setValue(key);
      setFromLink(true);
      setBusy(true);
      void signIn(key);
    });
  }, [signIn]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = accountKeyFromInput(value);
    if (!key) {
      setError("Paste the whole sign-in link (it ends in #key=…) or just the key.");
      return;
    }
    setError(null);
    setBusy(true);
    void signIn(key);
  }

  const inputId = `${id}-key`;
  const errorId = `${id}-error`;

  return (
    <Card padding="lg" className="space-y-6">
      {fromLink && busy ? (
        <p role="status" className="font-medium">
          Signing you in…
        </p>
      ) : null}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-2">
          <label htmlFor={inputId} className="block font-semibold">
            Your sign-in link or key
          </label>
          <input
            id={inputId}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://…/signin#key=…"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="block min-h-12 w-full rounded-xl border border-border-strong bg-surface px-4 font-mono text-sm text-text placeholder:font-sans placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {error ? (
            <p id={errorId} ref={errorRef} tabIndex={-1} role="alert" className="text-sm font-medium text-danger outline-none">
              {error}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
          Sign in
        </Button>
      </form>
      <div className="space-y-2 border-t border-border pt-5 text-[0.9375rem] leading-relaxed text-muted">
        <p>
          Your sign-in link was shown once, when you set up your radar (or made a new link in settings). It looks like{" "}
          <span className="font-mono text-text">…/signin#key=…</span>
        </p>
        <p>
          Lost it? If your radar is still open on another device, make a new link there under Settings. Otherwise you
          can set up a new radar in about 10 minutes.
        </p>
      </div>
    </Card>
  );
}
