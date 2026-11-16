// ============================================================================
// Where an entry's control lives, as a link (2026-11-16, DOCK_LOOP_SLICE1 §3.3).
// Client-safe and pure. Surfaces are addressed by the cms-ui convention
// `?surface=<descriptor>` (surface/url.ts), which opens the popup on the page.
// ============================================================================
import { actionMeta } from './catalogue';

export interface ActionRoute {
  href: string;
  /** The `data-eac-anchor` to outline once there. */
  anchor: string | null;
  how: string | null;
}

/**
 * `null` when there is nothing to travel to: an entry done in the dock, an external
 * window, no address, or an org address with no org to name.
 */
export function routeFor(id: string, opts: { hub: string; orgSlug?: string | null; partial?: boolean }): ActionRoute | null {
  const a = actionMeta(id)?.address;
  if (!a || a.dock || a.external || !a.path) return null;
  const needsOrg = a.path.includes('{org}') || (a.surface ?? '').includes('{org}');
  if (needsOrg && !opts.orgSlug) return null;
  const org = encodeURIComponent(opts.orgSlug ?? '');
  const fill = (s: string) => s.replace(/\{org\}/g, org);
  // The directory entry has two homes: the address is under Details, the switch under Where you show.
  const surface = id === 'listing' && opts.partial ? 'profile:show' : a.surface;
  let href = `${opts.hub}${fill(a.path)}`;
  if (surface) href += `${href.includes('?') ? '&' : '?'}surface=${encodeURIComponent(fill(surface))}`;
  return { href, anchor: a.anchor ?? null, how: a.how ?? null };
}

/** Adds the return ticket to a route's href. */
export function withTicket(href: string, ticket: string | null): string {
  if (!ticket) return href;
  const hash = href.indexOf('#');
  const base = hash >= 0 ? href.slice(0, hash) : href;
  const tail = hash >= 0 ? href.slice(hash) : '';
  return `${base}${base.includes('?') ? '&' : '?'}eac-step=${encodeURIComponent(ticket)}${tail}`;
}
