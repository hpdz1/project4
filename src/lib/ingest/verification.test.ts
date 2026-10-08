import { describe, expect, it } from "vitest";
import { isProviderLink, parseForwardingVerification } from "./verification";
import { makeEmail } from "./test-helpers";

const CONFIRM =
  "https://mail-settings.google.com/mail/vf-%5BANGjdJ9rEDlM0vhdq-lNC0bDWNXZMoX6xULHQwCiS9jhsQr4h0vhYtkbXDg92PdMdg20gce7eIiW0q-ojyeu%5D-wnsSokJrkwN559YRdPH1fqpDxF0";
const CANCEL = CONFIRM.replace("/vf-", "/uf-");

function gmailBody(confirm: string, extra = ""): string {
  return `jane.doe@gmail.com has requested to automatically forward mail to your email
address r-testalias0001@in.example.com.

To allow jane.doe@gmail.com to forward mail to your address automatically,
please click the link below to confirm the request:

${confirm}

If you click the link and it appears to be broken, please copy and paste it
into a new browser window.
${extra}
Thanks for using Gmail!

If you accidentally clicked the link, but you do not want to allow jane.doe@gmail.com to
automatically forward messages to your address, click this link to cancel this
verification:
${CANCEL}

To learn more about why you might have received this message, please
visit: http://support.google.com/mail/bin/answer.py?answer=184973.`;
}

const gmail = (fields: Parameters<typeof makeEmail>[0] = {}) =>
  makeEmail({
    from: "forwarding-noreply@google.com",
    fromName: "Gmail Team",
    subject: "(Gmail Forwarding Confirmation - Receive Mail from jane.doe@gmail.com",
    text: gmailBody(CONFIRM),
    ...fields,
  });

describe("Gmail forwarding confirmation", () => {
  it("extracts the confirm link and the requesting mailbox (current, link-only format)", () => {
    expect(parseForwardingVerification(gmail())).toEqual({
      provider: "gmail",
      requestedBy: "jane.doe@gmail.com",
      code: null,
      link: CONFIRM,
      receivedAt: "2026-10-08T14:00:00.000Z",
    });
  });

  it("extracts a legacy code from the subject and the body", () => {
    const fromSubject = parseForwardingVerification(
      gmail({ subject: "(#871234567) Gmail Forwarding Confirmation - Receive Mail from jane.doe@gmail.com" }),
    );
    expect(fromSubject?.code).toBe("871234567");
    const fromBody = parseForwardingVerification(gmail({ text: gmailBody(CONFIRM, "\nConfirmation code: 59387283\n") }));
    expect(fromBody?.code).toBe("59387283");
  });

  it("reads the French legacy format", () => {
    const v = parseForwardingVerification(
      gmail({
        fromName: "L'équipe Gmail",
        subject: "(#115250375) Confirmation du transfert par Gmail - Réception du message de didier@gmail.com",
        text: `Code de confirmation : 115250375\n\n${CONFIRM}`,
      }),
    );
    expect(v).toMatchObject({ provider: "gmail", code: "115250375", requestedBy: "didier@gmail.com", link: CONFIRM });
  });

  it("finds the link in HTML too", () => {
    const v = parseForwardingVerification(gmail({ text: "", html: `<p>Confirm: <a href="${CONFIRM}">${CONFIRM}</a></p>` }));
    expect(v?.link).toBe(CONFIRM);
  });

  it("never returns the cancel (uf-) link", () => {
    const v = parseForwardingVerification(gmail({ text: `Cancel: ${CANCEL}` }));
    expect(v?.link).toBeNull();
  });

  it.each([
    ["http (not https)", CONFIRM.replace("https://", "http://")],
    ["look-alike host", CONFIRM.replace("mail-settings.google.com", "mail-settings.google.com.evil.net")],
    ["other domain", "https://evil.example/mail/vf-%5Babc%5D-def"],
    ["credentials in the URL", CONFIRM.replace("https://", "https://user:pass@")],
    ["odd port", CONFIRM.replace("google.com/", "google.com:8443/")],
    ["not a vf- path", "https://mail.google.com/mail/u/0/#settings/fwdandpop"],
  ])("rejects a non-Google confirmation link: %s", (_label, link) => {
    const v = parseForwardingVerification(gmail({ text: gmailBody(link) }));
    expect(v?.provider).toBe("gmail");
    expect(v?.link).toBeNull();
  });

  it("ignores look-alike senders", () => {
    expect(parseForwardingVerification(gmail({ from: "forwarding-noreply@google.com.evil.net" }))).toBeNull();
    expect(parseForwardingVerification(gmail({ from: "forwarding-noreply@gmail-security.example" }))).toBeNull();
  });

  it("ignores ordinary mail", () => {
    expect(parseForwardingVerification(makeEmail({ from: "mcinfo@ups.com", subject: "UPS Update", text: "hi" }))).toBeNull();
  });
});

describe("other providers", () => {
  it("reads a Yahoo verification link on a yahoo.com host only", () => {
    const v = parseForwardingVerification(
      makeEmail({
        from: "no-reply@cc.yahoo-inc.com",
        subject: "Verify your forwarding address",
        text: [
          "sam.example@yahoo.com wants to forward mail to r-testalias0001@in.example.com.",
          "Help: https://help.yahoo.com/kb/SLN29133.html",
          "Phish: https://login.yahoo.com.evil.net/verify?x=1",
          "Verify: https://login.yahoo.com/account/forwarding/verify?token=abc123",
        ].join("\n"),
      }),
    );
    expect(v).toMatchObject({
      provider: "yahoo",
      requestedBy: "sam.example@yahoo.com",
      link: "https://login.yahoo.com/account/forwarding/verify?token=abc123",
    });
  });

  it("needs a code or a provider link for non-Gmail providers", () => {
    expect(
      parseForwardingVerification(
        makeEmail({ from: "noreply@icloud.com", subject: "Confirm mail forwarding", text: "Visit https://evil.example/confirm" }),
      ),
    ).toBeNull();
  });
});

describe("isProviderLink", () => {
  it("accepts subdomains of the provider over https", () => {
    expect(isProviderLink("https://mail-settings.google.com/mail/vf-x", ["google.com"])).toBe(true);
    expect(isProviderLink("https://google.com:443/x", ["google.com"])).toBe(true);
    expect(isProviderLink("https://notgoogle.com/x", ["google.com"])).toBe(false);
    expect(isProviderLink("not a url", ["google.com"])).toBe(false);
  });
});
