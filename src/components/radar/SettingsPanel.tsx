"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { AccountView } from "@/lib/types";
import { countryName } from "@/lib/location";
import { api, errorMessage } from "@/lib/client/api";
import { currentOrigin } from "@/lib/client/browser";
import { signInLink } from "@/lib/client/format";
import { clearLocalData } from "@/lib/client/saved-location";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { ConfirmDialog } from "./ConfirmDialog";
import { SignInLinkCallout } from "./SignInLinkCallout";

export interface SettingsPanelProps {
  account: AccountView;
  onSignedOut: () => void;
  onDeleted: () => void;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}

const TEXT_LINK = "font-medium text-accent underline underline-offset-4 hover:no-underline";

/**
 * Collapsible dashboard settings: forwarding address, delivery area, a new
 * sign-in link, sign out, and "Delete my data".
 */
export function SettingsPanel({ account, onSignedOut, onDeleted }: SettingsPanelProps) {
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<{ where: "rotate" | "signout" | "delete"; message: string } | null>(null);

  async function rotate() {
    setRotating(true);
    setError(null);
    try {
      const res = await api.rotateKey();
      setNewLink(signInLink(currentOrigin(), res.accountKey));
      setConfirmRotate(false);
    } catch (e) {
      setError({ where: "rotate", message: errorMessage(e) });
    } finally {
      setRotating(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    setError(null);
    try {
      await api.signOut();
      onSignedOut();
    } catch (e) {
      setError({ where: "signout", message: errorMessage(e) });
      setSigningOut(false);
    }
  }

  async function deleteEverything() {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteAccount();
      clearLocalData();
      setDeleteOpen(false);
      onDeleted();
    } catch (e) {
      setError({ where: "delete", message: errorMessage(e) });
      setDeleting(false);
    }
  }

  const area = [
    account.postalCode ? (account.country === "US" ? `ZIP ${account.postalCode}` : account.postalCode) : null,
    account.region,
    countryName(account.country) ?? account.country,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section aria-labelledby="settings-heading" className="space-y-4">
      <h2 id="settings-heading" className="text-xl font-bold tracking-tight">
        Settings
      </h2>
      <details className="group rounded-2xl border border-border bg-surface shadow-sm">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-3 font-semibold [&::-webkit-details-marker]:hidden">
          <span>Forwarding address, sign-in link and your data</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </summary>
        <div className="space-y-8 border-t border-border p-5 sm:p-6">
          <Block title="Forwarding address">
            <p className="text-[0.9375rem] leading-relaxed text-muted">
              Carrier alerts forwarded here show up on this dashboard.{" "}
              <Link href="/setup#forward" className={TEXT_LINK}>
                Forwarding instructions
              </Link>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 rounded-lg border border-border bg-subtle px-3 py-2 font-mono text-sm break-all">
                {account.inboundAddress}
              </code>
              <CopyButton text={account.inboundAddress} label="Copy address" aria-label="Copy address: your forwarding address" />
            </div>
          </Block>

          <Block title="Delivery area">
            <p className="text-[0.9375rem] leading-relaxed">
              {area}
              <span className="text-muted"> · times shown for {account.timezone}</span>
            </p>
            <p className="text-sm text-muted">
              We only store your country, ZIP or postcode and state.{" "}
              <Link href="/setup#address" className={TEXT_LINK}>
                Change
              </Link>
            </p>
          </Block>

          <Block title="Sign-in link">
            <p className="text-[0.9375rem] leading-relaxed text-muted">
              Lost your link, or think someone else has it? Make a new one. The old link stops working straight away,
              and other phones or computers signed in with it are signed out.
            </p>
            {confirmRotate ? (
              <div className="space-y-3 rounded-xl border border-warning/40 bg-warning-soft p-4">
                <p className="text-[0.9375rem]">Make a new sign-in link? Your current link will stop working.</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={rotate} loading={rotating}>
                    Make a new link
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmRotate(false)} disabled={rotating}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmRotate(true)}>
                Get a new sign-in link
              </Button>
            )}
            {error?.where === "rotate" ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error.message}
              </p>
            ) : null}
            {newLink ? (
              <SignInLinkCallout
                link={newLink}
                title="Your new sign-in link"
                note="Your previous link no longer works."
              />
            ) : null}
          </Block>

          <Block title="Sign out">
            <p className="text-[0.9375rem] leading-relaxed text-muted">
              Signs this device out. Your radar keeps collecting alerts; you&apos;ll need your sign-in link to come back.
            </p>
            <Button variant="secondary" onClick={signOut} loading={signingOut}>
              Sign out
            </Button>
            {error?.where === "signout" ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error.message}
              </p>
            ) : null}
          </Block>

          <Block title="Delete my data">
            <p className="text-[0.9375rem] leading-relaxed text-muted">
              Permanently deletes your radar: the forwarding address, every shipment and your settings. This can&apos;t
              be undone.
            </p>
            <Button
              variant="danger"
              onClick={() => {
                setError(null);
                setDeleteOpen(true);
              }}
            >
              Delete my data
            </Button>
          </Block>
        </div>
      </details>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete your radar?"
        confirmLabel="Delete everything"
        destructive
        busy={deleting}
        error={error?.where === "delete" ? error.message : null}
        onConfirm={deleteEverything}
        onCancel={() => setDeleteOpen(false)}
      >
        <p>
          This deletes your forwarding address, all shipments and your settings right away, and signs you out. Emails
          forwarded afterwards are thrown away.
        </p>
        <p>Remember to remove the forwarding filter or rule in your email, too.</p>
      </ConfirmDialog>
    </section>
  );
}
