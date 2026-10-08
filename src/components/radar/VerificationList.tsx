import type { ForwardingVerification } from "@/lib/types";
import { describeVerification, formatRelativeTime, providerName, safeExternalUrl } from "@/lib/client/format";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { CopyButton } from "@/components/ui/CopyButton";
import { ExternalIcon } from "./icons";

export interface VerificationListProps {
  verifications: readonly ForwardingVerification[];
  /** Server time, for "received 3 minutes ago". */
  now: string;
}

/**
 * Forwarding confirmations (Gmail codes and links) that reached the inbound
 * address. The link confirms forwarding to this account, so it is only ever
 * shown to the signed-in owner and opened without a referrer.
 */
export function VerificationList({ verifications, now }: VerificationListProps) {
  if (verifications.length === 0) return null;
  return (
    <div className="space-y-3">
      {verifications.map((v, i) => {
        const link = safeExternalUrl(v.link);
        const when = formatRelativeTime(v.receivedAt, now);
        return (
          <Callout
            key={`${v.receivedAt}-${v.code ?? ""}-${i}`}
            tone="warning"
            title={`Confirm forwarding in ${providerName(v.provider)}`}
          >
            <p>{describeVerification({ ...v, link })}</p>
            {v.requestedBy || when ? (
              <p className="text-sm text-muted">
                {v.requestedBy ? `Requested by ${v.requestedBy}` : null}
                {v.requestedBy && when ? " · " : null}
                {when ? `received ${when}` : null}
              </p>
            ) : null}
            {link || v.code ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {link ? (
                  <Button
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    size="sm"
                    className="whitespace-normal! text-left"
                  >
                    Open the confirmation link
                    <ExternalIcon className="size-3.5" />
                  </Button>
                ) : null}
                {v.code ? (
                  <CopyButton text={v.code} label="Copy code" aria-label={`Copy code ${v.code}`} />
                ) : null}
              </div>
            ) : null}
          </Callout>
        );
      })}
    </div>
  );
}
