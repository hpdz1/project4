import type { CarrierId, ProgramId } from "@/lib/types";

/** A carrier or retailer program users turn on once so they hear about parcels coming to them. */
export interface Program {
  id: ProgramId;
  name: string;
  operator: string;
  carrier: CarrierId | null;
  /** ISO 3166-1 alpha-2 codes where we've confirmed the program is offered. */
  countries: string[];
  /**
   * Offered in many more countries than `countries` lists (DHL Express On
   * Demand Delivery: 150+), so coverage shows it everywhere.
   */
  worldwide?: boolean;
  /** address = shows everything headed to your verified address; account = tied to your login/email/phone; per_package = one shipment at a time. */
  kind: "address" | "account" | "per_package";
  /** One plain sentence. */
  shows: string;
  cost: string;
  signupUrl: string;
  /** Country-specific sign-up pages that replace `signupUrl` (e.g. PostNord's app page per country). */
  signupUrlByCountry?: Partial<Record<string, string>>;
  dashboardUrl: string | null;
  /** How the program checks who you are, including mailed codes and waits. */
  verification: string;
  setupTime: string;
  emailAlerts: {
    /** Steps to turn on email alerts in the program (empty when it has none we can forward). */
    howToEnable: string[];
    /** Lowercase sender addresses to forward, for the default country. Empty when we know of none. */
    senders: string[];
    /** Per-country sender lists that replace `senders` (e.g. amazon.co.uk in GB). */
    sendersByCountry?: Partial<Record<string, string[]>>;
  };
  /** "full": we parse status, dates and shippers; "basic": tracking numbers and common status words only. */
  parserSupport: "full" | "basic";
  gotchas: string[];
  guideSlug: "usps-informed-delivery" | "ups-my-choice" | "fedex-delivery-manager" | null;
}
