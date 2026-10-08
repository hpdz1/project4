import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_INBOUND_DOMAIN, getServerConfig } from "./config";

describe("getServerConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("has safe defaults", () => {
    expect(getServerConfig({})).toEqual({
      inboundDomain: DEFAULT_INBOUND_DOMAIN,
      inboundSecret: null,
      databasePath: null,
      demoMode: false,
      secureCookies: false,
      trustProxy: false,
    });
  });

  it("reads and normalizes every variable", () => {
    expect(
      getServerConfig({
        INBOUND_DOMAIN: " @In.Example.COM. ",
        INBOUND_SECRET: "  s3cret  ",
        DATABASE_PATH: "/data/radar.db",
        DEMO_MODE: "1",
        NODE_ENV: "production",
        TRUST_PROXY: "1",
      }),
    ).toEqual({
      inboundDomain: "in.example.com",
      inboundSecret: "s3cret",
      databasePath: "/data/radar.db",
      demoMode: true,
      secureCookies: true,
      trustProxy: true,
    });
  });

  it("treats a blank INBOUND_SECRET as unset (inbound disabled, never an empty secret)", () => {
    expect(getServerConfig({ INBOUND_SECRET: "   " }).inboundSecret).toBeNull();
    expect(getServerConfig({ INBOUND_SECRET: "" }).inboundSecret).toBeNull();
  });

  it("defaults demo mode on in development only, and DEMO_MODE overrides it", () => {
    expect(getServerConfig({ NODE_ENV: "development" }).demoMode).toBe(true);
    expect(getServerConfig({ NODE_ENV: "development", DEMO_MODE: "0" }).demoMode).toBe(false);
    expect(getServerConfig({ NODE_ENV: "production" }).demoMode).toBe(false);
    expect(getServerConfig({ NODE_ENV: "production", DEMO_MODE: "1" }).demoMode).toBe(true);
    expect(getServerConfig({ NODE_ENV: "test" }).demoMode).toBe(false);
  });

  it("only trusts the proxy when TRUST_PROXY is on", () => {
    expect(getServerConfig({ TRUST_PROXY: "0" }).trustProxy).toBe(false);
    expect(getServerConfig({ TRUST_PROXY: "maybe" }).trustProxy).toBe(false);
    expect(getServerConfig({ TRUST_PROXY: "1" }).trustProxy).toBe(true);
  });

  it("reads process.env on every call", () => {
    vi.stubEnv("INBOUND_DOMAIN", "one.example");
    expect(getServerConfig().inboundDomain).toBe("one.example");
    vi.stubEnv("INBOUND_DOMAIN", "two.example");
    expect(getServerConfig().inboundDomain).toBe("two.example");
  });
});
