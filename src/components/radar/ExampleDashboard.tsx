import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/Badge";
import { ShipmentCard } from "./ShipmentCard";

type ExampleShipment = ComponentProps<typeof ShipmentCard>["shipment"] & { id: string };

/** Made-up packages for the landing page illustration. Never linked to real tracking pages. */
const EXAMPLE_SHIPMENTS: ExampleShipment[] = [
  {
    id: "ex-usps",
    carrier: "usps",
    trackingNumber: "9400111899223197428497",
    trackingUrl: null,
    orderRef: null,
    shipper: "ACME OUTDOOR CO",
    description: null,
    status: "out_for_delivery",
    userMarkedDelivered: false,
    headline: "Out for delivery",
    expectedWindow: null,
  },
  {
    id: "ex-ups",
    carrier: "ups",
    trackingNumber: "1Z999AA10987654328",
    trackingUrl: null,
    orderRef: null,
    shipper: "NORTHWIND HOME GOODS",
    description: null,
    status: "in_transit",
    userMarkedDelivered: false,
    headline: "Expected tomorrow",
    expectedWindow: "9:00 AM - 1:00 PM",
  },
  {
    id: "ex-fedex",
    carrier: "fedex",
    trackingNumber: "398765432103",
    trackingUrl: null,
    orderRef: null,
    shipper: "CONTOSO BOOKS",
    description: null,
    status: "in_transit",
    userMarkedDelivered: false,
    headline: "Expected Friday",
    expectedWindow: null,
  },
];

const TILES = [
  { label: "Arriving today", value: 1 },
  { label: "On the way", value: 2 },
  { label: "Needs attention", value: 0 },
  { label: "Delivered recently", value: 0 },
];

/** A static, clearly labelled example of the dashboard for the landing page. */
export function ExampleDashboard() {
  return (
    <figure className="space-y-3">
      <div className="space-y-4 rounded-3xl border border-border bg-bg p-3 shadow-sm sm:p-5">
        <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-accent uppercase">My radar · ZIP 62701</p>
            <Badge tone="warning">Example</Badge>
          </div>
          <p className="mt-2 text-xl leading-tight font-bold tracking-tight sm:text-2xl">
            Yes — 3 packages are on the way, 1 arriving today.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TILES.map((t) => (
              <div key={t.label} className="rounded-xl border border-border bg-surface px-3 py-2">
                <dt className="text-xs text-muted">{t.label}</dt>
                <dd className="text-lg font-bold tabular-nums">{t.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ul className="space-y-3">
          {EXAMPLE_SHIPMENTS.map((s) => (
            <ShipmentCard key={s.id} shipment={s} />
          ))}
        </ul>
      </div>
      <figcaption className="text-sm text-muted">
        Example only: made-up packages showing how USPS, UPS and FedEx alerts appear side by side.
      </figcaption>
    </figure>
  );
}
