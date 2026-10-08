import type { Metadata } from "next";
import { DashboardView } from "@/components/radar/DashboardView";
import { Container } from "@/components/ui/Container";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "My radar",
    description: "Everything your carriers say is on the way to your home, in one place.",
    path: "/dashboard",
  }),
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <Container className="py-8 sm:py-12">
      <DashboardView />
    </Container>
  );
}
