import { OPERATOR, pageMetadata, showOperatorPlaceholders } from "@/lib/site";
import { TermsOfUse } from "./TermsOfUse";

export const metadata = pageMetadata({
  title: "Terms of use",
  description:
    "The plain-English terms for using Package Radar anywhere in the world: what the service does and doesn't promise, forwarding only email you're allowed to, fair use and your consumer rights.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <TermsOfUse operator={OPERATOR} showPlaceholders={showOperatorPlaceholders} />
  );
}
