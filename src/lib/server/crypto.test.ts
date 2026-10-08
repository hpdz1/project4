import { describe, expect, it } from "vitest";
import { findInboundAlias } from "@/lib/ingest";
import { base32, generateAccountKey, generateAlias, hashKey, safeEqual } from "./crypto";

describe("base32", () => {
  it("matches the RFC 4648 test vectors (lowercase, unpadded)", () => {
    const enc = (s: string) => base32(new TextEncoder().encode(s));
    expect(enc("")).toBe("");
    expect(enc("f")).toBe("my");
    expect(enc("fo")).toBe("mzxq");
    expect(enc("foo")).toBe("mzxw6");
    expect(enc("foob")).toBe("mzxw6yq");
    expect(enc("fooba")).toBe("mzxw6ytb");
    expect(enc("foobar")).toBe("mzxw6ytboi");
  });
});

describe("generateAlias", () => {
  it("is r- plus 16 base32 characters, and unique", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const alias = generateAlias();
      expect(alias).toMatch(/^r-[a-z2-7]{16}$/);
      seen.add(alias);
    }
    expect(seen.size).toBe(500);
  });

  it("is an alias the ingest router recognizes", () => {
    const alias = generateAlias();
    const email = {
      recipients: [`${alias}@in.example.com`],
      from: "mcinfo@ups.com",
      fromName: null,
      subject: "",
      text: "",
      html: "",
      headers: {},
      date: "2026-10-08T12:00:00.000Z",
    };
    expect(findInboundAlias(email, "in.example.com")).toBe(alias);
  });
});

describe("generateAccountKey", () => {
  it("is 43 base64url characters (256 bits), and unique", () => {
    const a = generateAccountKey();
    const b = generateAccountKey();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});

describe("hashKey", () => {
  it("is SHA-256 hex", () => {
    expect(hashKey("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hashKey(generateAccountKey())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("safeEqual", () => {
  it("compares strings of any length", () => {
    expect(safeEqual("secret", "secret")).toBe(true);
    expect(safeEqual("secret", "Secret")).toBe(false);
    expect(safeEqual("secret", "secret!")).toBe(false);
    expect(safeEqual("", "secret")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("ünïcode", "ünïcode")).toBe(true);
  });
});
