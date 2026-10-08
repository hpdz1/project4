/**
 * Typed fetch helpers for the Package Radar JSON API (see docs/ARCHITECTURE.md
 * "HTTP API"). Browser-only in practice, but free of React and DOM globals so
 * it can be unit-tested with an injected `fetch`.
 *
 * Every request is same-origin with credentials (the session cookie), asks
 * for JSON and is never cached. State-changing requests always send a JSON
 * body (`{}` when there is nothing to say), because the server requires one.
 */
import type {
  AccountCreatedResponse,
  AccountResponse,
  ApiError,
  CreateAccountRequest,
  DashboardResponse,
  UpdateAccountRequest,
  UpdateShipmentRequest,
} from "@/lib/types";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/** An API call that failed: an HTTP error status, or `status` 0 when the server couldn't be reached. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export function isApiClientError(value: unknown): value is ApiClientError {
  return value instanceof ApiClientError;
}

/** True for the error a fetch throws when its AbortSignal fires. */
export function isAbortError(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    (value as { name: unknown }).name === "AbortError"
  );
}

export type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export interface RequestOptions {
  method?: HttpMethod;
  /** JSON body; non-GET requests send `{}` when omitted. */
  body?: unknown;
  signal?: AbortSignal;
}

const NETWORK_MESSAGE =
  "We couldn't reach Package Radar. Check your connection and try again.";

/** Plain-language fallback for an HTTP status when the server sent no usable message. */
export function defaultErrorMessage(status: number): string {
  if (status === 0) return NETWORK_MESSAGE;
  if (status === 400 || status === 422) return "Something in that request wasn't right. Check it and try again.";
  if (status === 401) return "You're not signed in on this device.";
  if (status === 403) return "That request was blocked. Reload the page and try again.";
  if (status === 404) return "We couldn't find that. It may have been deleted.";
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  if (status >= 500) return "Package Radar had a problem on our side. Try again in a moment.";
  return `The request failed (HTTP ${status}).`;
}

function isApiErrorBody(value: unknown): value is ApiError {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  if (!text.trim()) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

const defaultFetcher: Fetcher = (input, init) => globalThis.fetch(input, init);

/**
 * Make one JSON request. Resolves with the parsed body (undefined for an
 * empty body, e.g. 204). Rejects with ApiClientError for HTTP errors and
 * network failures, and rethrows AbortError untouched.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  fetcher: Fetcher = defaultFetcher,
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  const init: RequestInit = {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal,
  };
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body ?? {});
  }

  let response: Response;
  try {
    response = await fetcher(path, init);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiClientError(0, "network_error", NETWORK_MESSAGE);
  }

  let text = "";
  try {
    text = await response.text();
  } catch (error) {
    if (isAbortError(error)) throw error;
    text = "";
  }
  const parsed = parseJson(text);

  if (!response.ok) {
    if (parsed.ok && isApiErrorBody(parsed.value)) {
      const { code, message } = parsed.value.error;
      throw new ApiClientError(
        response.status,
        code,
        message.trim() || defaultErrorMessage(response.status),
      );
    }
    throw new ApiClientError(
      response.status,
      `http_${response.status}`,
      defaultErrorMessage(response.status),
    );
  }

  if (!parsed.ok) {
    throw new ApiClientError(response.status, "invalid_json", defaultErrorMessage(500));
  }
  return parsed.value as T;
}

/** Message to show for any error thrown by the helpers below. */
export function errorMessage(error: unknown): string {
  if (isApiClientError(error)) return error.message;
  return defaultErrorMessage(0);
}

/** The typed endpoints, bound to one fetch implementation. */
export function createApiClient(fetcher: Fetcher = defaultFetcher) {
  const request = <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, options, fetcher);

  return {
    /** GET /api/account: 401 when this device has no session. */
    getAccount: (signal?: AbortSignal) =>
      request<AccountResponse>("/api/account", { signal }),
    /** POST /api/account: creates the account and signs this device in. The key is shown once. */
    createAccount: (body: CreateAccountRequest) =>
      request<AccountCreatedResponse>("/api/account", { method: "POST", body }),
    updateAccount: (body: UpdateAccountRequest) =>
      request<AccountResponse>("/api/account", { method: "PATCH", body }),
    deleteAccount: () => request<unknown>("/api/account", { method: "DELETE" }),
    /** POST /api/account/key: the old key stops working. */
    rotateKey: () =>
      request<AccountCreatedResponse>("/api/account/key", { method: "POST" }),
    signIn: (accountKey: string) =>
      request<AccountResponse>("/api/session", {
        method: "POST",
        body: { accountKey },
      }),
    signOut: () => request<unknown>("/api/session", { method: "DELETE" }),
    getDashboard: (signal?: AbortSignal) =>
      request<DashboardResponse>("/api/dashboard", { signal }),
    updateShipment: (id: string, body: UpdateShipmentRequest) =>
      request<unknown>(`/api/shipments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body,
      }),
    /** POST /api/demo/seed: only works when the server runs with DEMO_MODE=1. */
    seedDemo: () => request<unknown>("/api/demo/seed", { method: "POST" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The client the UI uses (the browser's fetch). */
export const api: ApiClient = createApiClient();
