/**
 * Where the Silex editor lives, and how to send someone into it.
 *
 * Shared because every app that can open the editor needs the same two
 * answers, and the first app to need them (arts-collective's /edit/[slug])
 * had them inline. A second copy in hidden-enneagram would have been the
 * third place the editor origin is spelled, and the origin has already moved
 * once (silex. → edit.arts-collective.com).
 */

const DEFAULT_SILEX_PORT = "6805";

export type EditorSearchParams = Record<string, string | string[] | undefined>;

/**
 * The editor origin. Configured in production; derived from the request in
 * dev, where Silex sits on its own port beside the app.
 */
export function resolveSilexEditorUrl(host: string, proto: string): string {
  const configured =
    process.env.SILEX_EDITOR_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_SILEX_URL ??
    process.env.SILEX_PUBLIC_URL;
  if (configured) return configured;

  const hostname = host.split(":")[0] || "localhost";
  const rootHostname = hostname.endsWith(".localhost") ? "localhost" : hostname;
  return `${proto}://${rootHostname}:${DEFAULT_SILEX_PORT}`;
}

/**
 * The full editor URL for one org, carrying the caller's query through.
 *
 * Everything in `searchParams` is forwarded — `t` (the one-time token) and
 * `mode` today, `page` for opening the editor on the page the editor was
 * standing on. The connector strips `t` on redemption and keeps the rest, so
 * `page` reaches the client config intact.
 */
export function buildSilexEditorUrl(
  baseUrl: string,
  slug: string,
  searchParams: EditorSearchParams
): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }
  url.searchParams.set("slug", slug);
  return url.toString();
}
