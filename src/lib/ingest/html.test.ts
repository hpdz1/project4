import { describe, expect, it } from "vitest";
import { decodeEntities, extractLinks, htmlToText } from "./html";

describe("htmlToText", () => {
  it("drops head, script, style, comments and doctype", () => {
    const html = `<!DOCTYPE html><html><head><title>Hidden title</title><style>p{color:red}</style>
      <script type="application/ld+json">{"@type":"ParcelDelivery"}</script></head>
      <body><!-- tracking pixel 1Z999AA10123456784 --><p>Visible</p><script>var x = "<p>no</p>";</script></body></html>`;
    expect(htmlToText(html)).toBe("Visible");
  });

  it("ends an unclosed <head> at <body>, and an unclosed <style> at the end", () => {
    expect(htmlToText('<html><head><meta charset="utf-8"><title>T</title><body><p>Body text</p></body></html>')).toBe("Body text");
    expect(htmlToText("<p>Before</p><style>p{color:red}<p>never shown</p>")).toBe("Before");
  });

  it("turns block elements and <br> into line breaks and table cells into spaces", () => {
    const html = `<div>Hi Sam,</div><p>Your package is<br/>arriving today.</p>
      <table><tr><td>Scheduled Delivery:</td><td>Thursday 10/08/2026</td></tr>
      <tr><th>Service</th><td>UPS Ground</td></tr></table><ul><li>One</li><li>Two</li></ul>`;
    expect(htmlToText(html)).toBe(
      "Hi Sam,\nYour package is\narriving today.\nScheduled Delivery: Thursday 10/08/2026\nService UPS Ground\nOne\nTwo",
    );
  });

  it("decodes named, decimal and hex entities", () => {
    expect(htmlToText("<p>USPS&reg; &amp; Fed&#69;x &#x2014; caf&eacute; &lt;b&gt; &quot;hi&quot; &hellip;</p>")).toBe(
      'USPS® & FedEx — café <b> "hi" …',
    );
  });

  it("removes zero-width characters that break numbers apart", () => {
    expect(htmlToText("<p>9400&#8203;1118&zwnj;9922\u200B3197&shy;4284\uFEFF97</p>")).toBe("9400111899223197428497");
  });

  it("collapses whitespace: source newlines, nbsp runs, blank lines", () => {
    const html = "<p>  Tracking\n   Number:&nbsp;&nbsp; 1Z999AA10123456784  </p>\n\n\n<p></p><p></p><div>Next</div>";
    expect(htmlToText(html)).toBe("Tracking Number: 1Z999AA10123456784\nNext");
    expect(htmlToText("<p>One</p><br><br><p>Two</p>")).toBe("One\n\nTwo");
  });

  it("keeps text around attributes that contain '>'", () => {
    expect(htmlToText('<a title="a > b" href="x">Track</a> it')).toBe("Track it");
  });

  it("handles empty and plain-text input", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText("just text")).toBe("just text");
  });
});

describe("decodeEntities", () => {
  it("leaves unknown entities and bare ampersands alone", () => {
    expect(decodeEntities("AT&T &unknown; &copy &amp")).toBe("AT&T &unknown; &copy &");
  });

  it("replaces invalid code points", () => {
    expect(decodeEntities("&#0;&#xD800;&#1114112;")).toBe("���");
  });
});

describe("extractLinks", () => {
  it("returns absolute http(s) hrefs, entity-decoded and deduplicated", () => {
    const html = `
      <a href="https://www.ups.com/track?loc=en_US&amp;tracknum=1Z999AA10123456784">Track</a>
      <a class="btn" href='https://www.ups.com/track?loc=en_US&amp;tracknum=1Z999AA10123456784'>Again</a>
      <A HREF=https://example.com/a>Unquoted</A>
      <a href="mailto:help@example.com">Mail</a><a href="tel:18005550100">Call</a>
      <a href="/relative">Rel</a><a href="javascript:alert(1)">JS</a>
      <area href="https://example.com/map">
      <a name="anchor">No href</a>`;
    expect(extractLinks(html)).toEqual([
      "https://www.ups.com/track?loc=en_US&tracknum=1Z999AA10123456784",
      "https://example.com/a",
      "https://example.com/map",
    ]);
  });

  it("does not take data-href or other attributes ending in href", () => {
    expect(extractLinks('<a data-href="https://evil.example/x" href="https://ok.example/y">x</a>')).toEqual([
      "https://ok.example/y",
    ]);
  });
});
