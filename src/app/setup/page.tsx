import type { Metadata } from "next";
import { SetupWizard } from "@/components/radar/SetupWizard";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Set up your radar",
    description:
      "A one-time setup: turn on your carriers' free delivery alerts and forward them to your private Package Radar address.",
    path: "/setup",
  }),
  robots: { index: false, follow: false },
};

export default function SetupPage() {
  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        eyebrow="One-time setup · about 10 minutes"
        title="Set up your Package Radar"
        description="Four short steps. You'll sign up with each carrier on its own website and add one forwarding rule in your email. We never ask for passwords or tracking numbers."
      />
      <SetupWizard />
    </Container>
  );
}
