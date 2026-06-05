import { createHash } from "node:crypto";

export type SignableValue = string | number | boolean | bigint | Date | null | undefined;
export type SignableParams = Record<string, SignableValue>;

export interface GatewayParams extends SignableParams {
  _aid: string;
  _akey: string;
  _requestMode: string;
  _sm: "md5" | string;
  _timestamp: string;
  _version: string;
  _mt: string;
}

export interface SignedParams extends GatewayParams {
  _sig: string;
}

export interface OpenPlatformOptions {
  url?: string;
  akey: string;
  asecret: string;
  mt: string;
  version?: string;
  aid?: string;
  requestMode?: string;
  signatureMethod?: "md5" | string;
  fetch?: GatewayFetch;
}

export type GatewayFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type RequestHeaders = Headers | Record<string, string> | Array<[string, string]>;

export interface RequestOptions {
  signal?: AbortSignal;
  /**
   * Defaults to 30 seconds, matching the reference Python SDK.
   * Set to 0 to disable request timeout.
   */
  timeoutMs?: number;
  headers?: RequestHeaders;
}

export const DEFAULT_GATEWAY_URL = "http://openapi.ovopark.com/m.api";
export const DEFAULT_AID = "S107";

export class OpenPlatformError extends Error {
  constructor(
    message: string,
    public readonly response: Response,
    public readonly body: string,
  ) {
    super(message);
    this.name = "OpenPlatformError";
  }
}

export function formatTimestamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());
  const second = pad2(date.getSeconds());

  return `${year}${month}${day}${hour}${minute}${second}`;
}

export function createSign(params: SignableParams, asecret: string): string {
  const payload = buildSignPayload(sortParams(params), asecret);

  return createHash("md5").update(payload, "utf8").digest("hex").toUpperCase();
}

export function createSignedParams(
  gatewayParams: GatewayParams,
  params: SignableParams,
  asecret: string,
): SignedParams {
  const sorted = sortParams({ ...gatewayParams, ...params }) as GatewayParams;
  const _sig = createSign(sorted, asecret);

  return { ...sorted, _sig };
}

export class OpenPlatform {
  readonly url: string;
  readonly akey: string;
  readonly asecret: string;
  readonly mt: string;
  readonly version: string;
  readonly aid: string;
  readonly requestMode: string;
  readonly signatureMethod: string;

  #fetch: GatewayFetch;

  constructor(options: OpenPlatformOptions) {
    this.url = options.url ?? DEFAULT_GATEWAY_URL;
    this.akey = options.akey;
    this.asecret = options.asecret;
    this.mt = options.mt;
    this.version = options.version ?? "v1";
    this.aid = options.aid ?? DEFAULT_AID;
    this.requestMode = options.requestMode ?? "POST";
    this.signatureMethod = options.signatureMethod ?? "md5";
    this.#fetch = options.fetch ?? fetch;
  }

  gatewayParams(timestamp = formatTimestamp()): GatewayParams {
    return {
      _aid: this.aid,
      _akey: this.akey,
      _requestMode: this.requestMode,
      _sm: this.signatureMethod,
      _timestamp: timestamp,
      _version: this.version,
      _mt: this.mt,
    };
  }

  createSign(params: SignableParams, timestamp = formatTimestamp()): string {
    return createSign({ ...this.gatewayParams(timestamp), ...params }, this.asecret);
  }

  createSignedParams(params: SignableParams, timestamp = formatTimestamp()): SignedParams {
    return createSignedParams(this.gatewayParams(timestamp), params, this.asecret);
  }

  async request<T = unknown>(params: SignableParams, options: RequestOptions = {}): Promise<T> {
    const signedParams = this.createSignedParams(params);
    const body = toUrlSearchParams(signedParams);
    const response = await this.#post(body, options);
    const text = await response.text();

    if (!response.ok) {
      throw new OpenPlatformError(`Ovopark request failed with status ${response.status}`, response, text);
    }

    return parseResponseBody<T>(text, response.headers.get("content-type"));
  }

  async #post(body: URLSearchParams, options: RequestOptions): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 30_000;
    const timeout = timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      return await this.#fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          ...headersToObject(options.headers),
        },
        body,
        signal: controller.signal,
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}

export function toUrlSearchParams(params: SignableParams): URLSearchParams {
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    body.append(key, stringifyValue(value));
  }

  return body;
}

function sortParams(params: SignableParams): Record<string, SignableValue> {
  return Object.fromEntries(Object.entries(params).sort());
}

function buildSignPayload(params: SignableParams, asecret: string): string {
  let payload = asecret;

  for (const [key, value] of Object.entries(params)) {
    payload += key;
    payload += stringifyValue(value);
  }

  return payload + asecret;
}

function stringifyValue(value: SignableValue): string {
  if (value instanceof Date) {
    return formatTimestamp(value);
  }

  return String(value);
}

function parseResponseBody<T>(text: string, contentType: string | null): T {
  if (!text) {
    return undefined as T;
  }

  if (contentType?.toLowerCase().includes("application/json")) {
    return JSON.parse(text) as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

function headersToObject(headers: RequestHeaders | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

export { OpenPlatform as openPlatform };
export default OpenPlatform;
