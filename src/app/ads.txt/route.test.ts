import { afterEach, describe, expect, it, vi } from "vitest";

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

describe("GET /ads.txt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns the Google seller line for the configured publisher", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-1234567890123456");
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe(
      "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n",
    );
  });

  it("is a 404 when AdSense is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "");
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("is a 404 for an invalid client id", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "pub-1234567890123456");
    const { GET } = await loadRoute();
    expect((await GET()).status).toBe(404);
  });
});
