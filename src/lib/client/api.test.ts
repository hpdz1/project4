import { describe, expect, it } from "vitest";
import {
  ApiClientError,
  apiRequest,
  createApiClient,
  defaultErrorMessage,
  errorMessage,
  isAbortError,
  isApiClientError,
  type Fetcher,
} from "./api";

interface Call {
  input: string;
  init: RequestInit;
}

function fakeFetch(
  respond: (call: Call) => Response | Promise<Response>,
): { fetcher: Fetcher; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: Fetcher = async (input, init) => {
    const call = { input, init };
    calls.push(call);
    return respond(call);
  };
  return { fetcher, calls };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiRequest", () => {
  it("sends GET without a body, same-origin, uncached", async () => {
    const { fetcher, calls } = fakeFetch(() => json(200, { ok: 1 }));
    await expect(apiRequest("/api/x", {}, fetcher)).resolves.toEqual({ ok: 1 });
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.body).toBeUndefined();
    expect(calls[0].init.credentials).toBe("same-origin");
    expect(calls[0].init.cache).toBe("no-store");
    expect((calls[0].init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("always sends a JSON body on state-changing requests", async () => {
    const { fetcher, calls } = fakeFetch(() => new Response(null, { status: 204 }));
    await expect(apiRequest("/api/session", { method: "DELETE" }, fetcher)).resolves.toBeUndefined();
    expect(calls[0].init.body).toBe("{}");
    expect((calls[0].init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    await apiRequest("/api/account", { method: "PATCH", body: { postalCode: "60614" } }, fetcher);
    expect(calls[1].init.body).toBe('{"postalCode":"60614"}');
  });

  it("throws ApiClientError with the server's code and message", async () => {
    const { fetcher } = fakeFetch(() =>
      json(401, { error: { code: "unauthorized", message: "Sign in first." } }),
    );
    const error = await apiRequest("/api/dashboard", {}, fetcher).catch((e: unknown) => e);
    expect(isApiClientError(error)).toBe(true);
    expect(error).toMatchObject({ status: 401, code: "unauthorized", message: "Sign in first." });
  });

  it("falls back to a status-based message for non-JSON errors", async () => {
    const { fetcher } = fakeFetch(() => new Response("<html>Bad gateway</html>", { status: 502 }));
    const error = await apiRequest("/api/x", {}, fetcher).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 502, code: "http_502" });
    expect((error as Error).message).toBe(defaultErrorMessage(502));
  });

  it("uses the fallback message when the server's message is blank", async () => {
    const { fetcher } = fakeFetch(() => json(429, { error: { code: "rate_limited", message: " " } }));
    const error = await apiRequest("/api/session", { method: "POST" }, fetcher).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 429, code: "rate_limited", message: defaultErrorMessage(429) });
  });

  it("maps network failures to status 0", async () => {
    const fetcher: Fetcher = async () => {
      throw new TypeError("Failed to fetch");
    };
    const error = await apiRequest("/api/x", {}, fetcher).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: "network_error" });
    expect(errorMessage(error)).toMatch(/couldn't reach/);
  });

  it("rethrows aborts untouched", async () => {
    const abort = new DOMException("The operation was aborted.", "AbortError");
    const fetcher: Fetcher = async () => {
      throw abort;
    };
    const error = await apiRequest("/api/x", {}, fetcher).catch((e: unknown) => e);
    expect(error).toBe(abort);
    expect(isAbortError(error)).toBe(true);
    expect(isAbortError(new Error("x"))).toBe(false);
  });

  it("rejects a 200 with an unreadable body", async () => {
    const { fetcher } = fakeFetch(() => new Response("{not json", { status: 200 }));
    await expect(apiRequest("/api/x", {}, fetcher)).rejects.toMatchObject({ code: "invalid_json" });
  });
});

describe("createApiClient", () => {
  it("hits the documented endpoints", async () => {
    const { fetcher, calls } = fakeFetch(() => json(200, {}));
    const client = createApiClient(fetcher);
    await client.getAccount();
    await client.createAccount({ country: "US", postalCode: "60614", region: "IL", timezone: "America/Chicago" });
    await client.updateAccount({ programs: { ups_my_choice: "done" } });
    await client.deleteAccount();
    await client.rotateKey();
    await client.signIn("k".repeat(43));
    await client.signOut();
    await client.getDashboard();
    await client.updateShipment("shp/1 2", { hidden: true });
    await client.seedDemo();

    expect(calls.map((c) => `${c.init.method} ${c.input}`)).toEqual([
      "GET /api/account",
      "POST /api/account",
      "PATCH /api/account",
      "DELETE /api/account",
      "POST /api/account/key",
      "POST /api/session",
      "DELETE /api/session",
      "GET /api/dashboard",
      "PATCH /api/shipments/shp%2F1%202",
      "POST /api/demo/seed",
    ]);
    expect(JSON.parse(String(calls[5].init.body))).toEqual({ accountKey: "k".repeat(43) });
    expect(JSON.parse(String(calls[8].init.body))).toEqual({ hidden: true });
  });

  it("passes abort signals through", async () => {
    const { fetcher, calls } = fakeFetch(() => json(200, {}));
    const controller = new AbortController();
    await createApiClient(fetcher).getDashboard(controller.signal);
    expect(calls[0].init.signal).toBe(controller.signal);
  });
});

describe("errorMessage", () => {
  it("gives a generic message for unknown errors", () => {
    expect(errorMessage(new Error("boom"))).toBe(defaultErrorMessage(0));
    expect(errorMessage(new ApiClientError(404, "not_found", "Gone."))).toBe("Gone.");
  });
});
