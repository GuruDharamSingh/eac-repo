import { isAllowedHandoffOrigin } from "@elkdonis/auth-server";
import { connectionRedirectUri } from "@elkdonis/services";

/**
 * Helpers for /api/connections/{start,callback} (services/connections.ts).
 * The origin comes from the registered redirect URI rather than the request:
 * request.nextUrl.origin reports 0.0.0.0:<port> behind the proxy.
 */
export function networkOrigin(): string {
  return new URL(connectionRedirectUri()).origin;
}

/** An absolute URL on a network origin, or null. */
export function safeReturn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol.startsWith("http") && isAllowedHandoffOrigin(url.origin) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The return URL with the outcome in its query, for the panel to show. */
export function withOutcome(target: string, id: string | null, error: string | null): string {
  const url = new URL(target);
  if (id) url.searchParams.set("connection", id);
  if (error) url.searchParams.set("connection_error", error);
  else url.searchParams.set("connected", "1");
  return url.toString();
}
