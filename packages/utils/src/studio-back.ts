// ============================================================================
// Studio "back" links (developer, 2026-11-12; docs/open/CHANNEL_ON_SITES_2026-11-12.md §3.3).
//
// A site sends a person to arts-collective.com/studio with `back=<site url>`;
// the Studio sends them back after Save or Publish. Pure string work, no
// imports, so a site and the Studio share one validator.
// ============================================================================

export const STUDIO_BACK_MAX_LENGTH = 512;
export const STUDIO_BACK_LABEL_MAX = 60;

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
}

/**
 * Normalised URL when `raw` is a place the Studio may send a person back to, else null.
 * Rules: absolute URL; `https:` (`http:` only for a localhost host when `allowLocalhost`);
 * no credentials; `host` (port included, if any) equals an entry of `allowedHosts`
 * case-insensitively, with no wildcard or subdomain matching; at most 512 characters;
 * path and query kept, fragment dropped.
 */
export function checkStudioBack(
  raw: string | null | undefined,
  allowedHosts: readonly string[],
  opts: { allowLocalhost: boolean },
): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > STUDIO_BACK_MAX_LENGTH) return null;
  if (/[\u0000-\u001f\u007f\\\s]/.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.username || u.password) return null;
  const local = isLocalHostname(u.hostname);
  if (u.protocol === 'http:') {
    if (!(opts.allowLocalhost && local)) return null;
  } else if (u.protocol !== 'https:') {
    return null;
  }
  if (!u.hostname) return null;
  const host = u.host.toLowerCase();
  if (!allowedHosts.some((h) => h.trim().toLowerCase() === host)) return null;
  u.hash = '';
  const out = u.toString();
  return out.length > STUDIO_BACK_MAX_LENGTH ? null : out;
}

/** `backLabel`: plain text, trimmed, at most 60 characters; null when empty or too long. */
export function cleanStudioBackLabel(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/[\u0000-\u001f\u007f<>]/g, '').trim();
  return t && t.length <= STUDIO_BACK_LABEL_MAX ? t : null;
}

/** Adds `back` / `backLabel` to a Studio query, for a host's `studioHref`. Unset values add nothing. */
export function setStudioBackParams(q: URLSearchParams, o: { back?: string | null; backLabel?: string | null }): void {
  if (!o.back) return;
  q.set('back', o.back);
  if (o.backLabel) q.set('backLabel', o.backLabel);
}
