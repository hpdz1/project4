import { OPERATOR, pageMetadata, showOperatorPlaceholders } from "@/lib/site";
import { PrivacyPolicy } from "./PrivacyPolicy";

export const metadata = pageMetadata({
  title: "Privacy policy",
  description:
    "What Package Radar collects, what it never keeps, how long data is kept, how advertising cookies work, your rights wherever you live, and how to download or delete everything.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <PrivacyPolicy
      operator={OPERATOR}
      showPlaceholders={showOperatorPlaceholders}
    />
  );
}
