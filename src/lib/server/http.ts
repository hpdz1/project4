import { NextResponse } from "next/server";
import type { z } from "zod";
import type { ApiError } from "@/lib/types";
import { getServerConfig, type ServerConfig } from "./config";

/**
 * JSON helpers for route handlers: uniform `ApiError` bodies, body reading
 * with content-type and size checks, and the same-origin (CSRF) check.
 */

export type ApiErrorCode =
  | "invalid_json"
  | "invalid_input"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "payload_too_large"
  | "unsupported_media_type"
  | "rate_limited"
  | "demo_disabled"
  | "inbound_disabled"
  | "server_error";

/** Largest JSON body the browser-facing routes accept. */
export const MAX_JSON_BYTES = 16 * 1024;

/** An error that becomes an `ApiError` response; thrown inside `handleApi`. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly headers: Record<string, string>;

  constructor(status: number, code: ApiErrorCode, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

/** A JSON response that is never cached (every API response carries private data or is a mutation). */
export function json<T>(data: T, init: { status?: number; headers?: Record<string, string> } = {}): NextResponse<T> {
  const response = NextResponse.json(data, { status: init.status ?? 200, headers: init.headers });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** An `ApiError` JSON response. */
export function errorJson(
  status: number,
  code: ApiErrorCode,
  message: string,
  headers: Record<string, string> = {},
): NextResponse<ApiError> {
  return json<ApiError>({ error: { code, message } }, { status, headers });
}

/**
 * Runs a route body: `HttpError`s become their `ApiError` response, anything
 * else is logged and becomes a generic 500 (no stack traces or messages leak).
 */
export async function handleApi(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof HttpError) return errorJson(err.status, err.code, err.message, err.headers);
    console.error("[api] unexpected error:", err instanceof Error ? (err.stack ?? err.message) : err);
    return errorJson(500, "server_error", "Something went wrong on our side. Please try again.");
  }
}

function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  return value.split(";")[0].trim().toLowerCase() === "application/json";
}

async function readBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge(maxBytes);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function tooLarge(maxBytes: number): HttpError {
  return new HttpError(413, "payload_too_large", `The request body is larger than ${maxBytes} bytes.`);
}

/**
 * Reads and parses a JSON request body.
 * @throws HttpError 415 unless Content-Type is application/json, 413 when the
 *   body is over `maxBytes`, 400 invalid_json when it is empty, not UTF-8 or not JSON.
 */
export async function readJsonBody(request: Request, maxBytes: number = MAX_JSON_BYTES): Promise<unknown> {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    throw new HttpError(415, "unsupported_media_type", "Send the request body as application/json.");
  }
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge(maxBytes);

  const bytes = await readBytes(request, maxBytes);
  if (bytes.byteLength === 0) throw new HttpError(400, "invalid_json", "The request body is empty.");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new HttpError(400, "invalid_json", "The request body is not valid UTF-8.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "invalid_json", "The request body is not valid JSON.");
  }
}

/**
 * Validates `value` with a zod schema.
 * @throws HttpError 400 invalid_input naming the first problem (never echoing the value).
 */
export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue && issue.path.length ? `${issue.path.map(String).join(".")}: ` : "";
  throw new HttpError(400, "invalid_input", `${where}${issue?.message ?? "Invalid input."}`);
}

function firstListValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first ? first : null;
}

function stripDefaultPort(host: string): string {
  return host.toLowerCase().replace(/:(80|443)$/, "");
}

/**
 * The host the browser addressed: X-Forwarded-Host when behind a trusted proxy,
 * else the Host header, else the request URL's host. Lowercase.
 */
export function requestHost(request: Request, config: ServerConfig = getServerConfig()): string | null {
  const forwarded = config.trustProxy ? firstListValue(request.headers.get("x-forwarded-host")) : null;
  const host = forwarded ?? request.headers.get("host")?.trim();
  if (host) return stripDefaultPort(host);
  try {
    return stripDefaultPort(new URL(request.url).host);
  } catch {
    return null;
  }
}

/**
 * CSRF protection for state-changing browser routes: the request must carry an
 * Origin header whose host equals the request's host.
 * @throws HttpError 403 forbidden otherwise.
 */
export function assertSameOrigin(request: Request, config: ServerConfig = getServerConfig()): void {
  const origin = request.headers.get("origin");
  const denied = new HttpError(403, "forbidden", "Cross-site requests are not allowed.");
  if (!origin || origin === "null") throw denied;
  let originHost: string;
  try {
    originHost = stripDefaultPort(new URL(origin).host);
  } catch {
    throw denied;
  }
  const host = requestHost(request, config);
  if (!host || !originHost || originHost !== host) throw denied;
}

/**
 * The client IP for rate limiting. Behind a trusted proxy (TRUST_PROXY=1) it is
 * the right-most X-Forwarded-For entry, the address that proxy saw (left-most
 * entries can be forged by the client). Otherwise null: without a proxy we
 * cannot tell clients apart reliably, so callers share one bucket.
 */
export function clientIp(request: Request, config: ServerConfig = getServerConfig()): string | null {
  if (!config.trustProxy) return null;
  const entries = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ip = entries[entries.length - 1] ?? request.headers.get("x-real-ip")?.trim();
  return ip ? ip.slice(0, 64).toLowerCase() : null;
}
