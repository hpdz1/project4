import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { getServerConfig } from "./config";
import {
  HttpError,
  assertSameOrigin,
  clientIp,
  errorJson,
  handleApi,
  json,
  parseInput,
  readJsonBody,
  requestHost,
} from "./http";

const direct = getServerConfig({});
const proxied = getServerConfig({ TRUST_PROXY: "1" });

function post(body: BodyInit | null, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/x", { method: "POST", headers, body });
}

async function httpError(promise: Promise<unknown>): Promise<HttpError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  return err as HttpError;
}

function syncHttpError(fn: () => void): HttpError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    return e as HttpError;
  }
  throw new Error("expected an HttpError");
}

describe("json / errorJson", () => {
  it("never lets responses be cached", async () => {
    const res = json({ a: 1 }, { status: 201 });
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ a: 1 });
  });

  it("builds ApiError bodies", async () => {
    const res = errorJson(404, "not_found", "Nope", { "X-Extra": "1" });
    expect(res.status).toBe(404);
    expect(res.headers.get("x-extra")).toBe("1");
    expect(await res.json()).toEqual({ error: { code: "not_found", message: "Nope" } });
  });
});

describe("handleApi", () => {
  afterEach(() => vi.restoreAllMocks());

  it("turns HttpError into its response, with headers", async () => {
    const res = await handleApi(async () => {
      throw new HttpError(429, "rate_limited", "Slow down", { "Retry-After": "60" });
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await res.json()).toEqual({ error: { code: "rate_limited", message: "Slow down" } });
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await handleApi(async () => {
      throw new Error("database exploded at /secret/path");
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("server_error");
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(log).toHaveBeenCalled();
  });
});

describe("readJsonBody", () => {
  it("parses JSON (charset parameter allowed)", async () => {
    const value = await readJsonBody(post('{"a":[1,2]}', { "content-type": "application/json; charset=utf-8" }));
    expect(value).toEqual({ a: [1, 2] });
  });

  it("requires application/json (415)", async () => {
    for (const type of [undefined, "text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
      const err = await httpError(readJsonBody(post("{}", type ? { "content-type": type } : {})));
      expect(err.status).toBe(415);
      expect(err.code).toBe("unsupported_media_type");
    }
  });

  it("rejects bodies over the cap (413), by Content-Length or by actual size", async () => {
    const big = JSON.stringify({ s: "x".repeat(200) });
    const declared = await httpError(
      readJsonBody(post(big, { "content-type": "application/json", "content-length": String(big.length) }), 100),
    );
    expect(declared.status).toBe(413);
    const streamed = await httpError(readJsonBody(post(big, { "content-type": "application/json" }), 100));
    expect(streamed.status).toBe(413);
    expect(streamed.code).toBe("payload_too_large");
  });

  it("rejects empty, non-UTF-8 and malformed bodies (400 invalid_json)", async () => {
    const headers = { "content-type": "application/json" };
    for (const body of ["", "{nope", "{\"a\":", new Uint8Array([0x7b, 0xff, 0x7d])]) {
      const err = await httpError(readJsonBody(post(body, headers)));
      expect(err.status).toBe(400);
      expect(err.code).toBe("invalid_json");
    }
  });
});

describe("parseInput", () => {
  it("returns parsed data or a 400 naming the field", () => {
    const schema = z.object({ n: z.number() });
    expect(parseInput(schema, { n: 1 })).toEqual({ n: 1 });
    const err = syncHttpError(() => parseInput(schema, { n: "secret-value" }));
    expect(err.status).toBe(400);
    expect(err.code).toBe("invalid_input");
    expect(err.message).toMatch(/^n: /);
    expect(err.message).not.toContain("secret-value");
  });
});

describe("assertSameOrigin", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/x", { method: "POST", headers });

  it("accepts an Origin matching the Host header", () => {
    expect(() => assertSameOrigin(req({ host: "radar.example", origin: "https://radar.example" }), direct)).not.toThrow();
    expect(() => assertSameOrigin(req({ host: "localhost:3000", origin: "http://localhost:3000" }), direct)).not.toThrow();
    expect(() => assertSameOrigin(req({ host: "radar.example:443", origin: "https://radar.example" }), direct)).not.toThrow();
  });

  it("falls back to the request URL's host when there is no Host header", () => {
    expect(() => assertSameOrigin(req({ origin: "http://localhost:3000" }), direct)).not.toThrow();
  });

  it("rejects missing, null, malformed and foreign origins (403)", () => {
    for (const origin of [undefined, "null", "not a url", "https://evil.example", "http://localhost:3001", "https://radar.example.evil.example"]) {
      const headers: Record<string, string> = { host: "radar.example" };
      if (origin) headers.origin = origin;
      const err = syncHttpError(() => assertSameOrigin(req(headers), direct));
      expect(err.status).toBe(403);
      expect(err.code).toBe("forbidden");
    }
  });

  it("uses X-Forwarded-Host only behind a trusted proxy", () => {
    const headers = { host: "internal:8080", "x-forwarded-host": "radar.example", origin: "https://radar.example" };
    expect(() => assertSameOrigin(req(headers), proxied)).not.toThrow();
    expect(() => assertSameOrigin(req(headers), direct)).toThrow(HttpError);
  });

  it("requestHost prefers the first X-Forwarded-Host value when trusted", () => {
    const r = req({ host: "internal:8080", "x-forwarded-host": "Radar.Example, other.example" });
    expect(requestHost(r, proxied)).toBe("radar.example");
    expect(requestHost(r, direct)).toBe("internal:8080");
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost/", { headers });

  it("ignores forwarding headers unless the proxy is trusted", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9" }), direct)).toBeNull();
  });

  it("takes the right-most X-Forwarded-For entry (the one the proxy added)", () => {
    expect(clientIp(req({ "x-forwarded-for": "198.51.100.1, 203.0.113.9" }), proxied)).toBe("203.0.113.9");
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9" }), proxied)).toBe("203.0.113.9");
    expect(clientIp(req({ "x-real-ip": "203.0.113.7" }), proxied)).toBe("203.0.113.7");
    expect(clientIp(req({}), proxied)).toBeNull();
  });
});
