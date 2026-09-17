/**
 * The Graph API call itself.
 *
 * One place that builds a request, so three things are true everywhere rather
 * than remembered per call site:
 *
 *   * The version is pinned (see config.ts).
 *   * `appsecret_proof` is attached when the app secret is available. Meta
 *     recommends it for server-side calls: it is an HMAC of the token under
 *     the app secret, so a token stolen on its own cannot be replayed from
 *     somewhere that lacks the secret.
 *   * Errors carry Meta's own fields. Graph returns 400 for almost everything
 *     — a missing permission, an expired token, a URL its fetcher could not
 *     reach — and the status alone tells you nothing. `code`/`error_subcode`
 *     and `fbtrace_id` are what a support request or a retry decision needs.
 *
 * Tokens are never logged. `GraphError.message` is composed from Meta's text
 * and the endpoint, and the token lives only in the request body or query.
 */

import { GRAPH_BASE } from './config';
import { createHmac } from 'node:crypto';

export interface GraphErrorBody {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id?: string;
}

export class GraphError extends Error {
  readonly status: number;
  readonly code?: number;
  readonly subcode?: number;
  readonly traceId?: string;
  /** Meta's user-facing text, when it supplies one. Safe to show an author. */
  readonly userMessage?: string;

  constructor(endpoint: string, status: number, body: GraphErrorBody) {
    super(`Graph ${endpoint} failed (${status}): ${body.message}`);
    this.name = 'GraphError';
    this.status = status;
    this.code = body.code;
    this.subcode = body.error_subcode;
    this.traceId = body.fbtrace_id;
    this.userMessage = body.error_user_msg || body.error_user_title;
  }

  /**
   * Whether the token is the problem rather than the request.
   *
   * 190 is the expired/invalid token family; 102 is a session problem. Both
   * mean "reconnect the Page", which is a different message to an author than
   * "that image could not be fetched".
   */
  get isAuthProblem(): boolean {
    return this.code === 190 || this.code === 102;
  }

  /** Meta's rate limits: 4 and 17 app/user level, 32 page level, 613 custom. */
  get isRateLimited(): boolean {
    return [4, 17, 32, 613].includes(this.code ?? -1);
  }
}

/** HMAC-SHA256 of the access token, keyed by the app secret. */
export function appSecretProof(accessToken: string, appSecret: string): string {
  return createHmac('sha256', appSecret).update(accessToken).digest('hex');
}

export interface GraphRequest {
  /** Path below the version, e.g. `me/accounts` or `<page-id>/feed`. */
  path: string;
  /**
   * Empty string means "send no access_token". Only `oauth/access_token`
   * needs that: it authenticates with client_id + client_secret, and an
   * access_token alongside them is rejected as a conflicting credential.
   */
  accessToken: string;
  method?: 'GET' | 'POST' | 'DELETE';
  /** Query string for GET/DELETE, form body for POST. */
  params?: Record<string, string | number | boolean | undefined>;
  /** Supply to attach appsecret_proof. Omitted for calls that exchange it. */
  appSecret?: string;
}

/**
 * Call the Graph API and return the parsed body.
 *
 * Throws GraphError on anything Meta rejects, so callers can use try/catch
 * rather than checking a shape. A non-JSON response is still an error — Graph
 * answers JSON for every documented endpoint, so HTML back means a proxy or an
 * outage sat in front of it, and parsing it as success would be worse.
 */
export async function graph<T = unknown>(req: GraphRequest): Promise<T> {
  const { path, accessToken, method = 'GET', params = {}, appSecret } = req;

  const fields: Record<string, string> = {};
  if (accessToken) fields.access_token = accessToken;
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) fields[key] = String(value);
  }
  if (appSecret && accessToken) {
    fields.appsecret_proof = appSecretProof(accessToken, appSecret);
  }

  const url = new URL(`${GRAPH_BASE}/${path.replace(/^\//, '')}`);
  let body: URLSearchParams | undefined;

  if (method === 'POST') {
    body = new URLSearchParams(fields);
  } else {
    for (const [key, value] of Object.entries(fields)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method,
    body,
    headers: body ? { 'content-type': 'application/x-www-form-urlencoded' } : undefined,
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GraphError(path, response.status, {
      message: `Non-JSON response: ${text.slice(0, 200)}`,
    });
  }

  if (!response.ok) {
    const error = (parsed as { error?: GraphErrorBody }).error;
    throw new GraphError(path, response.status, error ?? { message: text.slice(0, 200) });
  }

  return parsed as T;
}
