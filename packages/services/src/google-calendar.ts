// ============================================================================
// A site's schedule written into a person's Google Calendar (migration 295,
// 2026-11-26). One way, site to Google.
//
// Consent is for `calendar.app.created`: the site makes its own calendar in the
// person's account and can read or change nothing else there. Each sync lists
// that calendar and makes it match what the site says: new runs are added,
// changed ones rewritten, runs that left the schedule removed. Events that have
// already happened are left alone.
//
// The site calls `syncOrgCalendarLinks` on a short interval. It reads the
// schedule, and goes to Google only when that differs from what was last
// written (or every few hours, to repair edits made in Google). So no write
// path on the site has to know about calendars.
//
// The site supplies the events (`GoogleCalendarSite.eventsFor`), so who sees
// what is decided where the site's roles are known. That function must throw
// rather than return an empty list when it cannot read the schedule: an empty
// list means "remove every upcoming event".
//
// OAuth client: GOOGLE_CALENDAR_CLIENT_ID/SECRET, else the collective's
// YOUTUBE_CLIENT_ID/SECRET. Its project needs the Calendar API on, this scope
// on the consent screen, and each site's callback as a redirect URI.
//
// Server only.
// ============================================================================

import { createHash, randomBytes } from 'node:crypto';
import { db } from '@elkdonis/db';
import { openSecret, sealSecret } from './connections';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const STATE_TTL_MS = 15 * 60 * 1000;
/** Marks an event as one this file wrote, and records what it wrote. */
const HASH_KEY = 'eacHash';

export type CalendarWhich = 'mine' | 'all';

export interface CalendarSyncEvent {
  /** Stable per run. A UUID or any hex string: Google event ids allow only a-v and 0-9. */
  key: string;
  title: string;
  description?: string;
  location?: string;
  /** ISO instants. */
  start: string;
  end: string;
  /** Where "open the source" in Google leads. */
  url?: string;
}

export interface GoogleCalendarSite {
  orgId: string;
  /** Name of the calendar made in the person's account. */
  calendarName: string;
  /** IANA zone the calendar and its events are written in. */
  timeZone: string;
  /**
   * Every run this person should have that starts at or after `from`.
   * `coveredUntil` (exclusive) when the list was cut short: nothing at or after
   * it is removed. Return an empty list for someone who may no longer see the
   * schedule. Throw when the schedule cannot be read.
   */
  eventsFor(userId: string, which: CalendarWhich, from: Date): Promise<{ events: CalendarSyncEvent[]; coveredUntil?: Date | null }>;
}

export interface CalendarLink {
  id: string;
  which: CalendarWhich;
  status: 'pending' | 'connected' | 'error';
  error: string | null;
  email: string | null;
  lastSyncedAt: string | null;
  eventCount: number | null;
  syncing: boolean;
}

export type CalendarResult<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

export function googleCalendarApp(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** False while migration 295 is not applied or the server has no client or sealing key. */
export async function googleCalendarAvailable(): Promise<boolean> {
  if (!googleCalendarApp() || !(process.env.CONNECTIONS_KEY || process.env.INTER_APP_JWT_SECRET)) return false;
  const [r] = await db`SELECT to_regclass('public.google_calendar_links') IS NOT NULL AS there`;
  return Boolean(r?.there);
}

type Row = Record<string, unknown>;

function mapLink(r: Row): CalendarLink {
  return {
    id: r.id as string,
    which: r.which as CalendarWhich,
    status: r.status as CalendarLink['status'],
    error: (r.error as string | null) ?? null,
    email: (r.google_email as string | null) ?? null,
    lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at as string).toISOString() : null,
    eventCount: r.event_count == null ? null : Number(r.event_count),
    syncing: Boolean(r.syncing),
  };
}

export async function getCalendarLink(userId: string, orgId: string): Promise<CalendarLink | null> {
  const [r] = await db`
    SELECT id, which, status, error, google_email, last_synced_at, event_count,
           (syncing_since IS NOT NULL AND syncing_since > now() - interval '10 minutes') AS syncing
    FROM google_calendar_links WHERE user_id = ${userId} AND org_id = ${orgId}
  `;
  return r ? mapLink(r) : null;
}

// ── consent ─────────────────────────────────────────────────────────────────

/** Record a one-time nonce and return Google's consent URL. */
export async function beginCalendarAuth(input: {
  userId: string;
  orgId: string;
  redirectUri: string;
  which: CalendarWhich;
}): Promise<CalendarResult<{ url: string }>> {
  const app = googleCalendarApp();
  if (!app) return { ok: false, error: 'Google Calendar is not set up on this server yet.' };
  const nonce = randomBytes(18).toString('base64url');
  const state = db.json({ nonce, startedAt: Date.now() });
  const [r] = await db`
    INSERT INTO google_calendar_links (user_id, org_id, client_id, which, oauth_state)
    VALUES (${input.userId}, ${input.orgId}, ${app.clientId}, ${input.which}, ${state})
    ON CONFLICT (user_id, org_id) DO UPDATE SET oauth_state = ${state}, which = ${input.which}, updated_at = now()
    RETURNING id
  `;
  const q = new URLSearchParams({
    client_id: app.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: `openid email ${CALENDAR_SCOPE}`,
    // offline + consent: a refresh token every time, so reconnecting replaces a dead one.
    access_type: 'offline',
    prompt: 'consent select_account',
    // Only the calendar scope: not whatever this client was granted before (YouTube).
    include_granted_scopes: 'false',
    state: `${r!.id}.${nonce}`,
  });
  return { ok: true, url: `${AUTH_URL}?${q.toString()}` };
}

/** The address in an id_token received directly from Google's token endpoint. */
function emailFromIdToken(idToken: string | undefined): string | null {
  try {
    const part = idToken?.split('.')[1];
    if (!part) return null;
    const claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { email?: unknown };
    return typeof claims.email === 'string' ? claims.email : null;
  } catch {
    return null;
  }
}

/** Google's redirect back: check the nonce, trade the code, keep the refresh token. */
export async function completeCalendarAuth(input: {
  userId: string;
  orgId: string;
  redirectUri: string;
  state: string | null;
  code: string | null;
  error: string | null;
}): Promise<CalendarResult<{ linkId: string }>> {
  const [row] = await db`
    SELECT id, client_id, oauth_state, refresh_token_enc, google_email
    FROM google_calendar_links WHERE user_id = ${input.userId} AND org_id = ${input.orgId}
  `;
  const pending = row?.oauth_state as { nonce?: string; startedAt?: number } | null | undefined;
  if (!row || !pending?.nonce || input.state !== `${row.id}.${pending.nonce}`) {
    return { ok: false, error: 'This sign-in link was already used or replaced. Start again.' };
  }
  const fail = async (error: string) => {
    // An earlier working connection stays as it was.
    await db`
      UPDATE google_calendar_links SET oauth_state = NULL, updated_at = now(),
        status = CASE WHEN refresh_token_enc IS NULL THEN 'error' ELSE status END, error = ${error}
      WHERE id = ${row.id as string}
    `;
    return { ok: false as const, error };
  };
  if (!pending.startedAt || Date.now() - pending.startedAt > STATE_TTL_MS) return fail('That took too long. Start again.');
  if (input.error) return fail(input.error === 'access_denied' ? 'Access was not granted at Google.' : `Google said: ${input.error}`);
  if (!input.code) return fail('Google returned no code.');
  const app = googleCalendarApp();
  if (!app || app.clientId !== row.client_id) {
    // The server's client changed between start and finish: take the current one on the next try.
    if (app) await db`UPDATE google_calendar_links SET client_id = ${app.clientId} WHERE id = ${row.id as string}`;
    return fail('The Google setup changed. Start again.');
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: input.code,
      client_id: app.clientId,
      client_secret: app.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const token = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !token.access_token) return fail(`Google refused the code: ${token.error_description ?? token.error ?? res.status}.`);
  if (!(token.scope ?? '').split(' ').includes(CALENDAR_SCOPE)) {
    return fail('Calendar access was not ticked at Google. Start again and allow it.');
  }
  if (!token.refresh_token) return fail('Google returned no lasting access. Remove this app at myaccount.google.com/permissions and connect again.');
  const email = emailFromIdToken(token.id_token);
  // Another Google account cannot see the calendar made in the first one.
  const sameAccount = !row.google_email || row.google_email === email;
  await db`
    UPDATE google_calendar_links SET
      refresh_token_enc = ${sealSecret(token.refresh_token)}, google_email = ${email}, status = 'connected', error = NULL,
      ${sameAccount ? db`` : db`calendar_id = NULL,`}
      content_hash = NULL, oauth_state = NULL, connected_at = now(), syncing_since = NULL, updated_at = now()
    WHERE id = ${row.id as string}
  `;
  return { ok: true, linkId: row.id as string };
}

export async function setCalendarWhich(userId: string, orgId: string, which: CalendarWhich): Promise<void> {
  await db`UPDATE google_calendar_links SET which = ${which}, content_hash = NULL, updated_at = now() WHERE user_id = ${userId} AND org_id = ${orgId}`;
}

// ── Google ──────────────────────────────────────────────────────────────────

class GoogleError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The grant is gone: stop until the person connects again. */
    readonly needsReconnect = false
  ) {
    super(message);
  }
}

async function accessToken(refreshEnc: string, clientId: string): Promise<string> {
  const app = googleCalendarApp();
  if (!app || app.clientId !== clientId) throw new GoogleError('The Google setup changed. Connect again.', 0, true);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      refresh_token: openSecret(refreshEnc),
      grant_type: 'refresh_token',
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (res.ok && data.access_token) return data.access_token;
  if (data.error === 'invalid_grant') throw new GoogleError('Google no longer accepts this connection (removed or expired). Connect again.', res.status, true);
  throw new GoogleError(`Google refused: ${data.error_description ?? data.error ?? res.status}.`, res.status);
}

/** One Calendar API call; waits and tries again on a rate limit. */
async function call<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; errors?: Array<{ reason?: string }> } };
    if (res.ok) return data as T;
    const reason = data.error?.errors?.[0]?.reason ?? '';
    const limited = res.status === 429 || (res.status === 403 && /rateLimit|userRateLimit/i.test(reason));
    if ((limited || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    throw new GoogleError(`Google Calendar said: ${data.error?.message ?? res.status}`, res.status);
  }
}

export interface GoogleEvent {
  id: string;
  status?: string;
  start?: { dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export function eventId(key: string): string {
  const clean = key.toLowerCase().replace(/[^a-v0-9]/g, '');
  return `eac${clean}`;
}

function eventBody(e: CalendarSyncEvent, timeZone: string) {
  const content = {
    summary: e.title,
    description: e.description ?? '',
    location: e.location ?? '',
    start: { dateTime: new Date(e.start).toISOString(), timeZone },
    end: { dateTime: new Date(e.end).toISOString(), timeZone },
    ...(e.url ? { source: { title: 'Open on the site', url: e.url } } : {}),
  };
  const hash = createHash('sha1').update(JSON.stringify(content)).digest('hex');
  return { id: eventId(e.key), status: 'confirmed', ...content, extendedProperties: { private: { [HASH_KEY]: hash } } };
}

export interface CalendarPlan {
  insert: ReturnType<typeof eventBody>[];
  update: ReturnType<typeof eventBody>[];
  remove: string[];
}

/** What has to change at Google for the calendar to match the site. Pure. */
export function planCalendarChanges(input: {
  wanted: CalendarSyncEvent[];
  present: GoogleEvent[];
  timeZone: string;
  from: Date;
  coveredUntil?: Date | null;
}): CalendarPlan {
  const present = new Map(input.present.map((e) => [e.id, e]));
  const plan: CalendarPlan = { insert: [], update: [], remove: [] };
  const wanted = new Set<string>();
  for (const e of input.wanted) {
    const body = eventBody(e, input.timeZone);
    wanted.add(body.id);
    const have = present.get(body.id);
    if (!have) plan.insert.push(body);
    else if (have.status === 'cancelled' || have.extendedProperties?.private?.[HASH_KEY] !== body.extendedProperties.private[HASH_KEY]) {
      plan.update.push(body);
    }
  }
  for (const e of input.present) {
    if (wanted.has(e.id) || e.status === 'cancelled' || !e.extendedProperties?.private?.[HASH_KEY]) continue;
    const start = e.start?.dateTime ? new Date(e.start.dateTime) : null;
    if (!start || start < input.from || (input.coveredUntil && start >= input.coveredUntil)) continue;
    plan.remove.push(e.id);
  }
  return plan;
}

async function listEvents(token: string, calendarId: string, from: Date): Promise<GoogleEvent[]> {
  const out: GoogleEvent[] = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({ maxResults: '2500', showDeleted: 'true', singleEvents: 'true', timeMin: from.toISOString() });
    if (pageToken) q.set('pageToken', pageToken);
    const page = await call<{ items?: GoogleEvent[]; nextPageToken?: string }>(
      token,
      'GET',
      `/calendars/${encodeURIComponent(calendarId)}/events?${q}`
    );
    out.push(...(page.items ?? []));
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

// ── syncing ─────────────────────────────────────────────────────────────────

export interface CalendarSyncCounts {
  added: number;
  changed: number;
  removed: number;
  total: number;
}

/** An unchanged schedule is still compared with Google this often. */
const FULL_SYNC_EVERY_MS = 6 * 3600_000;
/** After a failed sync, the interval caller waits this long before trying again. */
const RETRY_AFTER_MS = 10 * 60_000;

function fingerprint(events: CalendarSyncEvent[]): string {
  const sorted = [...events].sort((a, b) => a.key.localeCompare(b.key));
  return createHash('sha1')
    .update(JSON.stringify(sorted.map((e) => [e.key, e.title, e.description ?? '', e.location ?? '', e.start, e.end, e.url ?? ''])))
    .digest('hex');
}

/**
 * Make one person's calendar match the site. Safe to call often. Without
 * `force`, nothing is sent to Google when the schedule is as last written
 * (`counts` is null then).
 */
export async function syncCalendarLink(
  linkId: string,
  site: GoogleCalendarSite,
  opts: { force?: boolean } = {}
): Promise<CalendarResult<{ counts: CalendarSyncCounts | null }>> {
  const [link] = await db`
    SELECT user_id, which, content_hash, last_synced_at, error, updated_at FROM google_calendar_links
    WHERE id = ${linkId} AND org_id = ${site.orgId} AND status = 'connected' AND refresh_token_enc IS NOT NULL
  `;
  if (!link) return { ok: false, error: 'The calendar is not connected.' };
  const age = (v: unknown) => (v ? Date.now() - new Date(v as string).getTime() : Infinity);
  if (!opts.force && link.error && age(link.updated_at) < RETRY_AFTER_MS) return { ok: true, counts: null };

  const from = new Date(Date.now() - 24 * 3600_000);
  // The site first: if it cannot be read, nothing at Google is touched.
  let wanted: { events: CalendarSyncEvent[]; coveredUntil?: Date | null };
  try {
    wanted = await site.eventsFor(link.user_id as string, link.which as CalendarWhich, from);
  } catch (err) {
    console.error('[google-calendar] schedule not read:', err instanceof Error ? err.message : String(err));
    return { ok: false, error: 'The schedule could not be read. Try again shortly.' };
  }
  const { events, coveredUntil } = wanted;
  const hash = fingerprint(events);
  if (!opts.force && link.content_hash === hash && age(link.last_synced_at) < FULL_SYNC_EVERY_MS) return { ok: true, counts: null };

  const [row] = await db`
    UPDATE google_calendar_links SET syncing_since = now()
    WHERE id = ${linkId} AND status = 'connected'
      AND (syncing_since IS NULL OR syncing_since < now() - interval '10 minutes')
    RETURNING client_id, refresh_token_enc, calendar_id
  `;
  if (!row) return { ok: false, error: 'A sync is already running.' };
  try {
    const token = await accessToken(row.refresh_token_enc as string, row.client_id as string);

    let calendarId = row.calendar_id as string | null;
    let present: GoogleEvent[] = [];
    if (calendarId) {
      try {
        present = await listEvents(token, calendarId, from);
      } catch (err) {
        if (!(err instanceof GoogleError) || (err.status !== 404 && err.status !== 410)) throw err;
        // Deleted in Google: do not quietly make it again.
        await db`UPDATE google_calendar_links SET calendar_id = NULL WHERE id = ${linkId}`;
        throw new GoogleError('The calendar was deleted in Google. Connect again to make a new one.', err.status, true);
      }
    } else {
      const made = await call<{ id: string }>(token, 'POST', '/calendars', { summary: site.calendarName, timeZone: site.timeZone });
      calendarId = made.id;
      await db`UPDATE google_calendar_links SET calendar_id = ${calendarId} WHERE id = ${linkId}`;
    }

    const plan = planCalendarChanges({ wanted: events, present, timeZone: site.timeZone, from, coveredUntil });
    const base = `/calendars/${encodeURIComponent(calendarId)}/events`;
    for (const body of plan.insert) {
      try {
        await call(token, 'POST', base, body);
      } catch (err) {
        // The id is already taken (an event outside the listed window): rewrite it.
        if (!(err instanceof GoogleError) || err.status !== 409) throw err;
        await call(token, 'PUT', `${base}/${body.id}`, body);
      }
    }
    for (const body of plan.update) await call(token, 'PUT', `${base}/${body.id}`, body);
    for (const id of plan.remove) {
      try {
        await call(token, 'DELETE', `${base}/${id}`);
      } catch (err) {
        if (!(err instanceof GoogleError) || (err.status !== 404 && err.status !== 410)) throw err;
      }
    }
    // `which` may have changed while this ran: leave the fingerprint empty then, so the next pass rewrites.
    await db`
      UPDATE google_calendar_links SET last_synced_at = now(), event_count = ${events.length}, error = NULL,
        content_hash = CASE WHEN which = ${link.which as string} THEN ${hash}::text ELSE NULL END,
        syncing_since = NULL, updated_at = now()
      WHERE id = ${linkId}
    `;
    return { ok: true, counts: { added: plan.insert.length, changed: plan.update.length, removed: plan.remove.length, total: events.length } };
  } catch (err) {
    const known = err instanceof GoogleError;
    const message = known ? err.message : 'The sync did not finish. It is tried again shortly.';
    if (!known) console.error('[google-calendar] sync:', err instanceof Error ? err.message : String(err));
    await db`
      UPDATE google_calendar_links SET error = ${message}, syncing_since = NULL, content_hash = NULL, updated_at = now(),
        status = ${known && err.needsReconnect ? 'error' : 'connected'}
      WHERE id = ${linkId}
    `;
    return { ok: false, error: message };
  }
}

/** Every connected calendar of one site, one after another. Call on a short interval. */
export async function syncOrgCalendarLinks(site: GoogleCalendarSite): Promise<void> {
  if (!(await googleCalendarAvailable())) return;
  const rows = await db`SELECT id FROM google_calendar_links WHERE org_id = ${site.orgId} AND status = 'connected'`;
  for (const r of rows) await syncCalendarLink(r.id as string, site);
}

/**
 * Remove the calendar the site made, withdraw the grant, forget the row. The
 * grant is withdrawn only when nothing else of this person uses the same
 * client: Google withdraws every scope of a client at once (YouTube included).
 */
export async function disconnectCalendar(userId: string, orgId: string): Promise<void> {
  const [row] = await db`
    SELECT id, client_id, refresh_token_enc, calendar_id FROM google_calendar_links
    WHERE user_id = ${userId} AND org_id = ${orgId}
  `;
  if (!row) return;
  const sealed = row.refresh_token_enc as string | null;
  if (sealed) {
    try {
      if (row.calendar_id) {
        const token = await accessToken(sealed, row.client_id as string);
        await call(token, 'DELETE', `/calendars/${encodeURIComponent(row.calendar_id as string)}`);
      }
    } catch (err) {
      console.warn('[google-calendar] calendar not removed:', err instanceof Error ? err.message : String(err));
    }
    const others = await db`
      SELECT 1 FROM user_connections
        WHERE user_id = ${userId} AND client_id = ${row.client_id as string} AND refresh_token_enc IS NOT NULL
      UNION ALL
      SELECT 1 FROM google_calendar_links
        WHERE user_id = ${userId} AND client_id = ${row.client_id as string} AND id <> ${row.id as string} AND refresh_token_enc IS NOT NULL
      LIMIT 1
    `;
    if (others.length === 0) {
      try {
        await fetch(REVOKE_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: openSecret(sealed) }),
        });
      } catch {
        /* the row is removed either way */
      }
    }
  }
  await db`DELETE FROM google_calendar_links WHERE id = ${row.id as string}`;
}
