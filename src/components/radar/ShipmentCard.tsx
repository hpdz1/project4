import type { ReactNode } from "react";
import type { DashboardShipment } from "@/lib/types";
import { CARRIER_NAMES } from "@/lib/tracking/carriers";
import { extraWindow, shipmentStatusDisplay, shipmentTitle, truncateMiddle } from "@/lib/client/format";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";
import { ExternalIcon } from "./icons";

export interface ShipmentCardProps {
  shipment: Pick<
    DashboardShipment,
    | "carrier"
    | "trackingNumber"
    | "trackingUrl"
    | "orderRef"
    | "shipper"
    | "description"
    | "status"
    | "userMarkedDelivered"
    | "headline"
    | "expectedWindow"
  >;
  /** Buttons for the card ("Not mine", "Got it"); omitted on the static example. */
  actions?: ReactNode;
  className?: string;
}

const GROUP_ACCENT: Record<string, string> = {
  success: "before:bg-success",
  danger: "before:bg-danger",
  warning: "before:bg-warning",
  info: "before:bg-accent",
  neutral: "before:bg-border-strong",
};

/**
 * One package on the radar. Renders an <li>; put it in a <ul>. Pure
 * presentation, so it works on the server (landing example) and client.
 */
export function ShipmentCard({ shipment, actions, className }: ShipmentCardProps) {
  const carrier = CARRIER_NAMES[shipment.carrier] ?? CARRIER_NAMES.unknown;
  const status = shipmentStatusDisplay(shipment);
  const title = shipmentTitle(shipment);
  const deliveryWindow = extraWindow(shipment);
  const tn = shipment.trackingNumber;

  return (
    <li
      className={cx(
        "relative overflow-hidden rounded-2xl border border-border bg-surface p-4 pl-5 shadow-sm sm:p-5 sm:pl-6",
        "before:absolute before:inset-y-0 before:left-0 before:w-1.5",
        GROUP_ACCENT[status.tone],
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold tracking-wide text-muted uppercase">{carrier}</span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <h3 className="mt-1.5 text-base leading-snug font-semibold break-words sm:text-lg">{title}</h3>
      <p className="mt-1 text-[0.9375rem] leading-relaxed">{shipment.headline}</p>

      {deliveryWindow || tn ? (
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:flex sm:flex-wrap">
          {deliveryWindow ? (
            <div className="flex gap-1.5">
              <dt className="text-muted">Window</dt>
              <dd className="font-medium">{deliveryWindow}</dd>
            </div>
          ) : null}
          {tn ? (
            <div className="flex min-w-0 gap-1.5">
              <dt className="shrink-0 text-muted">Tracking</dt>
              <dd className="min-w-0">
                {shipment.trackingUrl ? (
                  <a
                    href={shipment.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={tn}
                    aria-label={`${tn} — track on ${carrier} (opens in a new tab)`}
                    className="inline-flex items-center gap-1 font-mono font-medium text-accent underline decoration-1 underline-offset-4 hover:no-underline"
                  >
                    {truncateMiddle(tn, 20)}
                    <ExternalIcon className="size-3.5 shrink-0" />
                  </a>
                ) : (
                  <span className="font-mono font-medium" title={tn}>
                    {truncateMiddle(tn, 20)}
                  </span>
                )}
              </dd>
            </div>
          ) : null}
          {shipment.orderRef && tn ? (
            <div className="flex gap-1.5">
              <dt className="text-muted">Order</dt>
              <dd className="font-mono">{shipment.orderRef}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {actions ? <div className="mt-3 -mb-1 flex flex-wrap gap-2">{actions}</div> : null}
    </li>
  );
}
