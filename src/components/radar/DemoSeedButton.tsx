"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface DemoSeedButtonProps {
  /** Called after the sample emails were accepted (e.g. to refresh the dashboard). */
  onSeeded?: () => void;
}

/**
 * Demo mode only: asks the server to feed six made-up carrier emails into
 * this radar. Clearly labelled so nobody mistakes them for real packages.
 */
export function DemoSeedButton({ onSeeded }: DemoSeedButtonProps) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function seed() {
    setState("sending");
    setMessage("");
    try {
      await api.seedDemo();
      setState("sent");
      setMessage("Sample emails sent. They'll show up in a few seconds.");
      onSeeded?.();
    } catch (error) {
      setState("error");
      setMessage(errorMessage(error));
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-border-strong bg-subtle p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="warning">Demo mode</Badge>
        <p className="text-sm text-muted">
          Adds made-up USPS, UPS, FedEx and Amazon emails so you can see how the radar works. They aren&apos;t real
          packages.
        </p>
      </div>
      <Button variant="secondary" onClick={seed} loading={state === "sending"}>
        Send sample emails
      </Button>
      <p
        role="status"
        className={state === "error" ? "text-sm font-medium text-danger" : "text-sm text-muted"}
      >
        {message}
      </p>
    </div>
  );
}
