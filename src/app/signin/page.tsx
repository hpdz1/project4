import type { Metadata } from "next";
import { SignInForm } from "@/components/radar/SignInForm";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Sign in",
    description: "Open your Package Radar on this device with your personal sign-in link.",
    path: "/signin",
  }),
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <PageHeader
        eyebrow="Sign in"
        title="Open your radar on this device"
        description="Use the personal sign-in link you saved when you set up Package Radar. There's no password."
      />
      <SignInForm />
    </Container>
  );
}
