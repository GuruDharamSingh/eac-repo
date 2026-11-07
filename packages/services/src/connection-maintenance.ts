/**
 * Daily care of outside connections (2026-11-01, run by the video worker):
 *
 *   1. Meta-family tokens older than 30 days are refreshed now rather than
 *      lazily at the next post, so a channel that is used rarely does not
 *      die quietly at 60 days.
 *   2. A Facebook token whose data-access window (90 days from consent) ends
 *      within a week, or any token Meta no longer accepts, earns the person
 *      one email asking them to reconnect, with a link to the Connections
 *      tab. One per connection per week, recorded in connection_events.
 */

import { db } from '@elkdonis/db';
import { refreshConnectionToken } from './connections';
import { metaApp } from './connections-meta';
import { logConnectionEvent } from './connection-events';
import { subscribeAllPageFeeds } from './external-comments';

const DAY = 24 * 60 * 60 * 1000;
const REFRESH_AFTER_MS = 30 * DAY;
const WARN_WITHIN_MS = 7 * DAY;

interface Row {
  id: string;
  user_id: string;
  provider: 'meta' | 'threads' | 'instagram';
  status: string;
  token_refreshed_at: Date | null;
  email: string | null;
  display_name: string | null;
}

export interface MaintenanceReport {
  checked: number;
  refreshed: number;
  failed: number;
  warned: number;
  /** Page webhook subscriptions: "3/4 subscribed" and what failed. */
  subscriptions: string;
}

function connectionsHref(): string {
  const host = (process.env.NEXT_PUBLIC_NETWORK_HOST ?? 'arts-collective.com').replace(/\/$/, '');
  return `${host.includes('localhost') ? 'http' : 'https'}://${host}/hub/network?surface=me:connections`;
}

async function warnedRecently(userId: string, connectionId: string): Promise<boolean> {
  const rows = await db`
    SELECT 1 FROM connection_events
    WHERE user_id = ${userId} AND connection_id = ${connectionId} AND event IN ('expiry_warned', 'refresh_failed')
      AND at > now() - interval '7 days' LIMIT 1
  `.catch(() => []);
  return rows.length > 0;
}

async function warn(row: Row, reason: string): Promise<boolean> {
  if (!row.email || (await warnedRecently(row.user_id, row.id))) return false;
  try {
    const { sendEmail } = await import('@elkdonis/email');
    const name = row.provider === 'meta' ? 'Facebook & Instagram' : row.provider === 'threads' ? 'Threads' : 'Instagram';
    await sendEmail({
      to: row.email,
      subject: `Your ${name} connection needs a reconnect`,
      html: `<p>Hello${row.display_name ? ` ${row.display_name}` : ''},</p>
<p>${reason}</p>
<p>Open <a href="${connectionsHref()}">Connections</a> on arts-collective.com and press Reconnect. Posting from the Studio to that account stops until you do.</p>
<p>The Elkdonis Arts Collective</p>`,
      kind: 'contact',
    });
    return true;
  } catch (err) {
    console.warn('[connections] warning mail failed:', err instanceof Error ? err.message : String(err));
    return false;
  }
}

/** Facebook: when the data-access window ends (seconds since epoch), from debug_token. */
async function dataAccessExpiry(token: string): Promise<number | null> {
  try {
    const app = metaApp();
    if (!app) return null;
    const q = new URLSearchParams({ input_token: token, access_token: `${app.appId}|${app.appSecret}` });
    const r = (await (await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}/debug_token?${q}`)).json()) as {
      data?: { data_access_expires_at?: number; is_valid?: boolean };
    };
    return r.data?.data_access_expires_at ?? null;
  } catch {
    return null;
  }
}

export async function refreshStaleConnections(): Promise<MaintenanceReport> {
  const report: MaintenanceReport = { checked: 0, refreshed: 0, failed: 0, warned: 0, subscriptions: '' };
  const rows = await db<Row[]>`
    SELECT c.id, c.user_id, c.provider, c.status, c.token_refreshed_at, u.email, u.display_name
    FROM user_connections c JOIN users u ON u.id = c.user_id
    WHERE c.provider IN ('meta', 'threads', 'instagram') AND c.refresh_token_enc IS NOT NULL AND c.status = 'connected'
  `;
  for (const row of rows) {
    report.checked += 1;
    const age = row.token_refreshed_at ? Date.now() - new Date(row.token_refreshed_at).getTime() : Infinity;
    if (age <= REFRESH_AFTER_MS) {
      // Fresh enough; still check Facebook's data-access window.
      if (row.provider === 'meta') {
        const t = await refreshConnectionToken(row.id, { force: false });
        if (!('error' in t)) {
          const exp = await dataAccessExpiry(t.accessToken);
          if (exp && exp * 1000 - Date.now() < WARN_WITHIN_MS) {
            if (await warn(row, 'Facebook limits how long an app may keep access to an account: yours ends within a week.')) {
              report.warned += 1;
              await logConnectionEvent({ userId: row.user_id, connectionId: row.id, provider: row.provider, event: 'expiry_warned', detail: { expiresAt: exp } });
            }
          }
        }
      }
      continue;
    }
    const t = await refreshConnectionToken(row.id, { force: true });
    // `in`, not `t.ok`: this codebase's result unions do not narrow on the flag.
    if ('error' in t) {
      report.failed += 1;
      if (await warn(row, `The platform no longer accepts the connection: ${t.error}`)) report.warned += 1;
      await logConnectionEvent({ userId: row.user_id, connectionId: row.id, provider: row.provider, event: 'refresh_failed', detail: { error: t.error } });
    } else {
      report.refreshed += 1;
      await logConnectionEvent({ userId: row.user_id, connectionId: row.id, provider: row.provider, event: 'refreshed' });
    }
  }
  // Keep every Page subscribed to the app's webhook (comments → threads).
  try {
    const sub = await subscribeAllPageFeeds();
    report.subscriptions = `${sub.subscribed}/${sub.pages} subscribed${sub.failed.length ? `; failed: ${sub.failed.join(' | ')}` : ''}`;
  } catch (err) {
    report.subscriptions = `error: ${err instanceof Error ? err.message : String(err)}`;
  }
  return report;
}
