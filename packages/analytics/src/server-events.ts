import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { recordCollect, type CollectOptions } from './collect';
import type { CollectPayload } from './index';

/**
 * Records a named event from a server action or route handler, where the
 * action's outcome is known (an order was created, a bid was accepted) and a
 * client click would only say it was attempted. The event joins the visitor's
 * session the same way a page view does: the visitor id is derived from the
 * request's IP and user agent, so it lands in the same session as the pages
 * around it. Its path is the page the action was invoked from (the Referer).
 *
 *   await trackServerEvent("add_to_cart", { artworkId }, analyticsOptions);
 *
 * Never throws and never blocks the action on failure; honours Do Not Track
 * and Global Privacy Control like the beacon. `props` values are strings,
 * numbers or booleans; keep ids and categories there, not personal data.
 */
export async function trackServerEvent(
  name: string,
  props?: CollectPayload['props'],
  options?: CollectOptions
): Promise<void> {
  try {
    const h = await headers();
    if (h.get('dnt') === '1' || h.get('sec-gpc') === '1') return;
    const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
    if (!host) return;
    const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip');

    let path = '/';
    const ref = h.get('referer');
    if (ref) {
      try {
        const u = new URL(ref);
        if (u.hostname.toLowerCase() === host) path = u.pathname;
      } catch { /* keep "/" */ }
    }

    let userId: string | null = null;
    try {
      const { getServerSession } = await import('@elkdonis/auth-server');
      const { user } = await getServerSession();
      userId = user?.db_user_id ?? user?.id ?? null;
    } catch {
      userId = null;
    }

    await recordCollect(
      { payload: { type: 'event', id: randomUUID(), path, name, props }, host, ip, userAgent: h.get('user-agent') ?? '', userId },
      options
    );
  } catch (err) {
    console.warn('[analytics] server event failed:', (err as Error).message);
  }
}
