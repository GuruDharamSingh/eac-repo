/**
 * Connections — a person's own OAuth links to outside services (migration 192).
 *
 * YouTube first. Since 2026-11-01 the collective's Google client
 * (YOUTUBE_CLIENT_ID/SECRET, youtubeApp()) is the default; a person may still
 * bring their own Google Cloud OAuth client: they
 * paste its client id and secret, then authorise once at Google; the refresh
 * token kept here lets the platform upload to that person's channel later
 * without them present (a circle's recordings, Studio publishing).
 *
 * One callback for the whole network, on the network host:
 *   https://<NEXT_PUBLIC_NETWORK_HOST>/api/connections/callback
 * (override with CONNECTIONS_OAUTH_REDIRECT_URI). That exact URI must be in the
 * client's "Authorised redirect URIs" in Google Cloud; connectionRedirectUri()
 * gives it to the forms so they can show it.
 *
 * Secrets: client_secret_enc and refresh_token_enc are AES-256-GCM, key derived
 * (HKDF-SHA256) from INTER_APP_JWT_SECRET, which every app container already
 * has. Rotating that secret makes stored tokens unreadable: the person then
 * re-enters the secret and connects again. Nothing here ever returns a secret
 * or token to a caller outside this file except getConnectionAccessToken.
 *
 * Every function takes the acting user's id and scopes its SQL to it, so a
 * connection id belonging to someone else is simply not found.
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { db } from '@elkdonis/db';
import { listUserMemberships } from './org-membership';
import { listChannelsForManager, setOrgChannel, type ChannelProvider } from './org-channels';
import { listConnectionEvents, logConnectionEvent } from './connection-events';
import { nanoid } from 'nanoid';
import {
  facebookAuthorizeUrl,
  facebookExchangeCode,
  facebookLongLivedToken,
  facebookMe,
  facebookPages,
  facebookPageById,
  facebookRevoke,
  metaApp,
  threadsApp,
  threadsAuthorizeUrl,
  threadsExchangeCode,
  threadsLongLivedToken,
  threadsMe,
  threadsRefreshToken,
  instagramApp,
  instagramAuthorizeUrl,
  instagramExchangeCode,
  instagramLongLivedToken,
  instagramRefreshToken,
  instagramMe,
  META_SCOPES,
  THREADS_SCOPES,
  INSTAGRAM_SCOPES,
  type MetaPageTarget,
} from './connections-meta';

/**
 * youtube: the person's own Google OAuth client (migration 192).
 * meta:    the collective's Facebook app; publishes to the person's Pages and
 *          their linked Instagram accounts (migration 217, 2026-10-29).
 * threads: the collective's Threads app; one profile per connection.
 * instagram: the collective's "Instagram API with Instagram Login" app; one
 *          professional account per connection, no Facebook Page needed.
 */
export type ConnectionProvider = 'youtube' | 'meta' | 'threads' | 'instagram';
export type ConnectionStatus = 'pending' | 'connected' | 'error';

/** What a form may see. No secret, no token. */
export interface UserConnection {
  id: string;
  provider: ConnectionProvider;
  label: string;
  /** The client id is not a secret; shown so the person can tell clients apart. */
  clientId: string;
  /** Uses the collective's app (always for Meta and Threads; YouTube when its client is YOUTUBE_CLIENT_ID). */
  collective: boolean;
  status: ConnectionStatus;
  error: string | null;
  accountId: string | null;
  accountName: string | null;
  accountUrl: string | null;
  connectedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  /** Meta: the Pages this connection may publish to. Empty for other providers. */
  targets: ConnectionTarget[];
}

/** A Page (and its Instagram account) as a form may see it: no token. */
export interface ConnectionTarget {
  id: string;
  name: string;
  /** The Page role allows CREATE_CONTENT. */
  canPublish: boolean;
  instagramUserId: string | null;
  instagramUsername: string | null;
}

export type ConnectionResult<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

export const CONNECTION_PROVIDERS: Record<ConnectionProvider, { name: string; scopes: string[] }> = {
  youtube: {
    name: 'YouTube',
    // upload: put videos on the channel. readonly: read the channel's name
    // and id back after consent (channels.list?mine=true needs it).
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
  },
  meta: { name: 'Facebook & Instagram', scopes: META_SCOPES },
  threads: { name: 'Threads', scopes: THREADS_SCOPES },
  instagram: { name: 'Instagram', scopes: INSTAGRAM_SCOPES },
};

/** Tokens older than this are exchanged again on use (Meta and Threads tokens last ~60 days). */
const TOKEN_REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE = 'https://oauth2.googleapis.com/revoke';
const YT_CHANNELS = 'https://www.googleapis.com/youtube/v3/channels';
/** How long a started authorisation stays valid. */
const STATE_TTL_MS = 15 * 60 * 1000;

/**
 * The collective's own Google OAuth client (YOUTUBE_CLIENT_ID/SECRET,
 * 2026-11-01), as Meta's apps are for Facebook: when set, a person connects
 * YouTube without bringing a client. Bring-your-own stays for anyone who
 * wants their own quota.
 */
export function youtubeApp(): { appId: string; appSecret: string } | null {
  const appId = process.env.YOUTUBE_CLIENT_ID;
  const appSecret = process.env.YOUTUBE_CLIENT_SECRET;
  return appId && appSecret ? { appId, appSecret } : null;
}

export function connectionRedirectUri(): string {
  const explicit = process.env.CONNECTIONS_OAUTH_REDIRECT_URI;
  if (explicit) return explicit;
  const host = (process.env.NEXT_PUBLIC_NETWORK_HOST ?? 'arts-collective.com').replace(/\/$/, '');
  const proto = host.includes('localhost') ? 'http' : 'https';
  return `${proto}://${host}/api/connections/callback`;
}

/** Where a person starts (or restarts) authorising a connection, on the network host. */
export function connectionStartUrl(id: string, returnTo?: string): string {
  const base = connectionRedirectUri().replace(/\/callback$/, '/start');
  const q = new URLSearchParams({ id });
  if (returnTo) q.set('return', returnTo);
  return `${base}?${q.toString()}`;
}

// ── encryption ──────────────────────────────────────────────────────────────

/**
 * Two key versions (2026-11-01). `v2` derives from CONNECTIONS_KEY, a secret
 * only the services that read connections hold; `v1` from INTER_APP_JWT_SECRET,
 * which every container has. New seals use v2 when the key is set; v1 rows
 * are re-sealed the next time they are read (resealLegacy).
 */
function keyFor(version: 'v1' | 'v2'): Buffer {
  if (version === 'v2') {
    const secret = process.env.CONNECTIONS_KEY;
    if (!secret) throw new Error('CONNECTIONS_KEY is not set in this container; a v2-sealed secret cannot be read here.');
    return Buffer.from(hkdfSync('sha256', secret, 'eac-connections', 'user_connections v2', 32));
  }
  const secret = process.env.INTER_APP_JWT_SECRET;
  if (!secret) throw new Error('INTER_APP_JWT_SECRET is not set; connections cannot store secrets.');
  return Buffer.from(hkdfSync('sha256', secret, 'eac-connections', 'user_connections v1', 32));
}
const SEAL_VERSION: 'v1' | 'v2' = process.env.CONNECTIONS_KEY ? 'v2' : 'v1';
const isLegacySeal = (sealed: string | null | undefined) => SEAL_VERSION === 'v2' && typeof sealed === 'string' && sealed.startsWith('v1.');

/** "v1.<iv>.<tag>.<ciphertext>", base64url parts. */
function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyFor(SEAL_VERSION), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [SEAL_VERSION, iv.toString('base64url'), c.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

function open(sealed: string): string {
  const [v, iv, tag, body] = sealed.split('.');
  if ((v !== 'v1' && v !== 'v2') || !iv || !tag || body === undefined) throw new Error('Unreadable stored secret.');
  const d = createDecipheriv('aes-256-gcm', keyFor(v), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
}

/** Re-seal a row's v1 secrets with the v2 key the first time they are read. Best effort. */
async function resealLegacy(id: string): Promise<void> {
  if (SEAL_VERSION !== 'v2') return;
  try {
    const rows = await db`SELECT client_secret_enc, refresh_token_enc, targets FROM user_connections WHERE id = ${id}`;
    const row = rows[0];
    if (!row) return;
    const targets = (Array.isArray(row.targets) ? (row.targets as MetaPageTarget[]) : []);
    const legacy = isLegacySeal(row.client_secret_enc) || isLegacySeal(row.refresh_token_enc) || targets.some((t) => isLegacySeal(t.tokenEnc));
    if (!legacy) return;
    const re = (v: string | null) => (v ? seal(open(v)) : v);
    const nextTargets = targets.map((t) => ({ ...t, tokenEnc: t.tokenEnc ? seal(open(t.tokenEnc)) : t.tokenEnc }));
    await db`
      UPDATE user_connections SET client_secret_enc = ${re(row.client_secret_enc)}, refresh_token_enc = ${re(row.refresh_token_enc)},
        targets = ${db.json(nextTargets as unknown as Parameters<typeof db.json>[0])}
      WHERE id = ${id}
    `;
  } catch (err) {
    console.warn('[connections] re-seal skipped:', err instanceof Error ? err.message : String(err));
  }
}

// ── rows ────────────────────────────────────────────────────────────────────

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

function mapRow(r: any): UserConnection {
  return {
    id: r.id,
    provider: r.provider,
    label: r.label ?? '',
    clientId: r.client_id,
    collective: r.provider !== 'youtube' || r.client_id === process.env.YOUTUBE_CLIENT_ID,
    status: r.status,
    error: r.error ?? null,
    accountId: r.account_id ?? null,
    accountName: r.account_name ?? null,
    accountUrl: r.account_url ?? null,
    connectedAt: iso(r.connected_at),
    lastUsedAt: iso(r.last_used_at),
    createdAt: iso(r.created_at)!,
    targets: Array.isArray(r.targets)
      ? (r.targets as MetaPageTarget[]).map((t) => ({
          id: t.id,
          name: t.name,
          canPublish: (t.tasks ?? []).includes('CREATE_CONTENT'),
          instagramUserId: t.instagramUserId ?? null,
          instagramUsername: t.instagramUsername ?? null,
        }))
      : [],
  };
}

const COLUMNS = db`
  id, provider, label, client_id, status, error, account_id, account_name,
  account_url, connected_at, last_used_at, created_at, targets
`;

export async function listConnections(userId: string): Promise<UserConnection[]> {
  const rows = await db`
    SELECT ${COLUMNS} FROM user_connections WHERE user_id = ${userId} ORDER BY created_at
  `;
  return rows.map(mapRow);
}

export async function getConnection(userId: string, id: string): Promise<UserConnection | null> {
  const rows = await db`
    SELECT ${COLUMNS} FROM user_connections WHERE user_id = ${userId} AND id = ${id}
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * A connection by id regardless of owner, without secrets. For a binding
 * (a circle's publish target) to show which channel it points at.
 */
export async function describeConnection(id: string): Promise<(UserConnection & { userId: string }) | null> {
  const rows = await db`SELECT ${COLUMNS}, user_id FROM user_connections WHERE id = ${id}`;
  return rows[0] ? { ...mapRow(rows[0]), userId: rows[0].user_id } : null;
}

// Google client ids look like "<digits>-<hash>.apps.googleusercontent.com".
const CLIENT_ID_RE = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i;

function cleanInput(input: { label?: unknown; clientId?: unknown; clientSecret?: unknown }) {
  const label = typeof input.label === 'string' ? input.label.trim().slice(0, 120) : undefined;
  const clientId = typeof input.clientId === 'string' ? input.clientId.trim() : undefined;
  const clientSecret = typeof input.clientSecret === 'string' ? input.clientSecret.trim() : undefined;
  return { label, clientId, clientSecret };
}

export async function createConnection(
  userId: string,
  input: { provider?: unknown; label?: unknown; clientId?: unknown; clientSecret?: unknown }
): Promise<ConnectionResult<{ connection: UserConnection }>> {
  const provider = (input.provider ?? 'youtube') as ConnectionProvider;
  if (provider === 'meta' || provider === 'threads' || provider === 'instagram') {
    const app = provider === 'meta' ? metaApp() : provider === 'threads' ? threadsApp() : instagramApp();
    if (!app) return { ok: false, error: `${CONNECTION_PROVIDERS[provider].name} is not configured on this server yet.` };
    const { label } = cleanInput(input);
    const id = nanoid(21);
    await db`
      INSERT INTO user_connections (id, user_id, provider, label, client_id, client_secret_enc)
      VALUES (${id}, ${userId}, ${provider}, ${label ?? ''}, ${app.appId}, ${seal(app.appSecret)})
    `;
    return { ok: true, connection: (await getConnection(userId, id))! };
  }
  if (provider !== 'youtube') return { ok: false, error: 'Unknown provider.' };
  const { label, clientId, clientSecret } = cleanInput(input);
  // No client posted: the collective's, when the server has one.
  const collective = !clientId ? youtubeApp() : null;
  if (collective) {
    const id = nanoid(21);
    await db`
      INSERT INTO user_connections (id, user_id, provider, label, client_id, client_secret_enc)
      VALUES (${id}, ${userId}, ${provider}, ${label ?? ''}, ${collective.appId}, ${seal(collective.appSecret)})
    `;
    return { ok: true, connection: (await getConnection(userId, id))! };
  }
  if (!clientId || !CLIENT_ID_RE.test(clientId)) {
    return { ok: false, error: 'The client ID should end in .apps.googleusercontent.com.' };
  }
  if (!clientSecret || clientSecret.length < 10 || clientSecret.length > 200) {
    return { ok: false, error: 'Paste the client secret from the same OAuth client.' };
  }
  const id = nanoid(21);
  await db`
    INSERT INTO user_connections (id, user_id, provider, label, client_id, client_secret_enc)
    VALUES (${id}, ${userId}, ${provider}, ${label ?? ''}, ${clientId}, ${seal(clientSecret)})
  `;
  return { ok: true, connection: (await getConnection(userId, id))! };
}

/** Rename, or replace the client. A new client id or secret drops the token: connect again. */
export async function updateConnection(
  userId: string,
  id: string,
  input: { label?: unknown; clientId?: unknown; clientSecret?: unknown }
): Promise<ConnectionResult<{ connection: UserConnection }>> {
  const current = await getConnection(userId, id);
  if (!current) return { ok: false, error: 'Not found.' };
  const { label, clientId, clientSecret } = cleanInput(input);
  if (current.provider !== 'youtube') {
    await db`UPDATE user_connections SET label = COALESCE(${label ?? null}, label), updated_at = now() WHERE user_id = ${userId} AND id = ${id}`;
    return { ok: true, connection: (await getConnection(userId, id))! };
  }
  if (clientId !== undefined && clientId !== current.clientId && !CLIENT_ID_RE.test(clientId)) {
    return { ok: false, error: 'The client ID should end in .apps.googleusercontent.com.' };
  }
  if (clientSecret !== undefined && clientSecret !== '' && (clientSecret.length < 10 || clientSecret.length > 200)) {
    return { ok: false, error: 'That does not look like a client secret.' };
  }
  const newClient = (clientId !== undefined && clientId !== current.clientId) || Boolean(clientSecret);
  await db`
    UPDATE user_connections SET
      label = COALESCE(${label ?? null}, label),
      client_id = COALESCE(${clientId || null}, client_id),
      client_secret_enc = COALESCE(${clientSecret ? seal(clientSecret) : null}, client_secret_enc),
      ${newClient ? db`refresh_token_enc = NULL, status = 'pending', error = NULL, connected_at = NULL,` : db``}
      updated_at = now()
    WHERE user_id = ${userId} AND id = ${id}
  `;
  return { ok: true, connection: (await getConnection(userId, id))! };
}

export async function deleteConnection(userId: string, id: string): Promise<boolean> {
  const rows = await db`
    DELETE FROM user_connections WHERE user_id = ${userId} AND id = ${id}
    RETURNING refresh_token_enc, provider, account_id
  `;
  if (!rows[0]) return false;
  const sealed = rows[0].refresh_token_enc as string | null;
  void logConnectionEvent({ userId, connectionId: id, provider: rows[0].provider, event: 'removed' });
  if (sealed && (rows[0].provider === 'threads' || rows[0].provider === 'instagram')) {
    // Neither API documents a revoke call (2026-11-01); the DELETE on
    // /me/permissions is tried in case it answers, and the outcome logged.
    // The person removes the app in their Threads or Instagram settings.
    const base = rows[0].provider === 'threads' ? 'https://graph.threads.net/v1.0' : 'https://graph.instagram.com';
    let outcome = 'unsupported';
    try {
      const res = await fetch(`${base}/me/permissions?access_token=${encodeURIComponent(open(sealed))}`, { method: 'DELETE' });
      outcome = `${res.status}`;
    } catch {
      outcome = 'unreachable';
    }
    void logConnectionEvent({ userId, connectionId: id, provider: rows[0].provider, event: 'revoke_attempted', detail: { outcome } });
    return true;
  }
  if (sealed && rows[0].provider === 'meta') {
    // Revoking at Facebook kills every token of that Facebook account, so
    // skip it while another connection still uses the same account
    // (2026-11-01: removing a duplicate row silently broke the kept one).
    const siblings = rows[0].account_id
      ? await db`SELECT 1 FROM user_connections WHERE provider = 'meta' AND account_id = ${rows[0].account_id} AND user_id = ${userId} LIMIT 1`
      : [];
    if (siblings.length === 0) {
      try {
        await facebookRevoke(open(sealed));
        void logConnectionEvent({ userId, connectionId: id, provider: 'meta', event: 'revoke_attempted', detail: { outcome: 'ok' } });
      } catch {
        void logConnectionEvent({ userId, connectionId: id, provider: 'meta', event: 'revoke_attempted', detail: { outcome: 'failed' } });
      }
    }
    return true;
  }
  if (rows[0].provider !== 'youtube') return true;
  // Best effort: tell Google the token is no longer wanted.
  if (sealed) {
    try {
      await fetch(`${GOOGLE_REVOKE}?token=${encodeURIComponent(open(sealed))}`, { method: 'POST' });
    } catch {
      /* the row is gone either way */
    }
  }
  return true;
}

// ── authorising at Google ───────────────────────────────────────────────────

/**
 * Begin consent: record a nonce, return Google's authorisation URL.
 * `returnTo` must already be checked by the caller (an allowed network origin).
 */
export async function beginConnectionAuth(
  userId: string,
  id: string,
  returnTo: string | null
): Promise<ConnectionResult<{ url: string }>> {
  const rows = await db`SELECT provider, client_id FROM user_connections WHERE user_id = ${userId} AND id = ${id}`;
  const row = rows[0];
  if (!row) return { ok: false, error: 'Not found.' };
  const nonce = randomBytes(18).toString('base64url');
  await db`
    UPDATE user_connections
    SET oauth_state = ${db.json({ nonce, returnTo, startedAt: Date.now() })}, updated_at = now()
    WHERE user_id = ${userId} AND id = ${id}
  `;
  const state = `${id}.${nonce}`;
  if (row.provider === 'meta') {
    return { ok: true, url: facebookAuthorizeUrl({ appId: row.client_id, redirectUri: connectionRedirectUri(), state }) };
  }
  if (row.provider === 'threads') {
    return { ok: true, url: threadsAuthorizeUrl({ appId: row.client_id, redirectUri: connectionRedirectUri(), state }) };
  }
  if (row.provider === 'instagram') {
    return { ok: true, url: instagramAuthorizeUrl({ appId: row.client_id, redirectUri: connectionRedirectUri(), state }) };
  }
  const q = new URLSearchParams({
    client_id: row.client_id,
    redirect_uri: connectionRedirectUri(),
    response_type: 'code',
    scope: CONNECTION_PROVIDERS[row.provider as ConnectionProvider].scopes.join(' '),
    // offline + consent: Google returns a refresh token every time, so a
    // reconnect replaces a dead token rather than coming back without one.
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state: `${id}.${nonce}`,
  });
  return { ok: true, url: `${GOOGLE_AUTH}?${q.toString()}` };
}

/** The connection id named in a callback's `state`, before any check. */
export function connectionIdFromState(state: string | null): string | null {
  const id = state?.split('.')[0];
  return id && /^[A-Za-z0-9_-]{21}$/.test(id) ? id : null;
}

/**
 * Finish consent: check the nonce, trade the code for tokens, read the
 * channel back, store it. Returns the stored return URL (if any) either way,
 * so the callback can send the person back with the outcome.
 */
export async function completeConnectionAuth(
  userId: string,
  params: { state: string | null; code: string | null; error: string | null }
): Promise<
  { ok: true; connection: UserConnection; returnTo: string | null } | { ok: false; error: string; returnTo: string | null }
> {
  const id = connectionIdFromState(params.state);
  if (!id) return { ok: false, error: 'The reply from Google did not name a connection.', returnTo: null };
  const rows = await db`
    SELECT provider, client_id, client_secret_enc, oauth_state
    FROM user_connections WHERE user_id = ${userId} AND id = ${id}
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: 'That connection is not yours, or was removed.', returnTo: null };
  const pending = row.oauth_state as { nonce?: string; returnTo?: string | null; startedAt?: number } | null;
  const returnTo = pending?.returnTo ?? null;
  const fail = async (error: string) => {
    void logConnectionEvent({ userId, connectionId: id, provider: row.provider, event: 'connect_failed', detail: { error } });
    await db`
      UPDATE user_connections SET oauth_state = NULL, status = CASE WHEN refresh_token_enc IS NULL THEN 'error' ELSE status END,
        error = ${error}, updated_at = now()
      WHERE user_id = ${userId} AND id = ${id}
    `;
    return { ok: false as const, error, returnTo };
  };

  if (!pending?.nonce || params.state !== `${id}.${pending.nonce}`) {
    return { ok: false, error: 'This sign-in link was already used or replaced. Start again.', returnTo };
  }
  if (!pending.startedAt || Date.now() - pending.startedAt > STATE_TTL_MS) return fail('That took too long. Start again.');
  const who = row.provider === 'meta' ? 'Facebook' : row.provider === 'threads' ? 'Threads' : row.provider === 'instagram' ? 'Instagram' : 'Google';
  if (params.error) return fail(params.error === 'access_denied' ? `Access was not granted at ${who}.` : `${who} said: ${params.error}`);
  if (!params.code) return fail(`${who} returned no code.`);

  let clientSecret: string;
  try {
    clientSecret = open(row.client_secret_enc);
  } catch {
    return fail('The stored client secret cannot be read any more. Enter it again.');
  }

  if (row.provider === 'meta' || row.provider === 'threads' || row.provider === 'instagram') {
    try {
      const finish = row.provider === 'meta' ? completeMeta : row.provider === 'threads' ? completeThreads : completeInstagram;
      await finish(userId, id, { appId: row.client_id, appSecret: clientSecret }, params.code);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
    void logConnectionEvent({ userId, connectionId: id, provider: row.provider, event: 'connected' });
    return { ok: true, connection: (await getConnection(userId, id))!, returnTo };
  }

  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: row.client_id,
      client_secret: clientSecret,
      redirect_uri: connectionRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const token = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !token.access_token) {
    return fail(`Google refused the code: ${token.error_description ?? token.error ?? tokenRes.status}.`);
  }
  if (!token.refresh_token) return fail('Google returned no refresh token. Remove this app at myaccount.google.com/permissions and connect again.');

  const granted = (token.scope ?? '').split(' ').filter(Boolean);
  const { channel, error: channelError } = await fetchOwnChannel(token.access_token);

  await db`
    UPDATE user_connections SET
      refresh_token_enc = ${seal(token.refresh_token)},
      scopes = ${granted},
      account_id = ${channel?.id ?? null},
      account_name = ${channel?.title ?? null},
      account_url = ${channel ? (channel.customUrl ? `https://www.youtube.com/${channel.customUrl}` : `https://www.youtube.com/channel/${channel.id}`) : null},
      status = 'connected',
      error = ${channelError},
      oauth_state = NULL,
      connected_at = now(),
      updated_at = now()
    WHERE user_id = ${userId} AND id = ${id}
  `;
  return { ok: true, connection: (await getConnection(userId, id))!, returnTo };
}

const NO_CHANNEL = 'Connected, but this Google account has no YouTube channel yet. Reconnect and pick the account (or brand account) that owns the channel.';

/**
 * The channel of the account that consented. `error` carries YouTube's own
 * message when the call fails (e.g. the Data API is not enabled in the
 * person's Google project), so the panel shows the real cause rather than
 * "no channel".
 */
async function fetchOwnChannel(
  accessToken: string
): Promise<{ channel: { id: string; title: string; customUrl: string | null } | null; error: string | null }> {
  try {
    const res = await fetch(`${YT_CHANNELS}?part=snippet&mine=true`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json().catch(() => ({}))) as {
      items?: Array<{ id: string; snippet?: { title?: string; customUrl?: string } }>;
      error?: { message?: string };
    };
    if (!res.ok) return { channel: null, error: `YouTube said: ${data.error?.message ?? res.status}` };
    const item = data.items?.[0];
    return item
      ? { channel: { id: item.id, title: item.snippet?.title ?? item.id, customUrl: item.snippet?.customUrl ?? null }, error: null }
      : { channel: null, error: NO_CHANNEL };
  } catch {
    return { channel: null, error: 'Could not reach YouTube to read the channel.' };
  }
}

/**
 * Facebook's dialog grants Page permissions per Page: when a person ticks
 * none, every permission is granted but /me/accounts is empty (verified
 * 2026-10-31: debug_token showed the scopes with no granular target_ids).
 */
const NO_PAGE_ERROR =
  'Connected, but no Page came back from Facebook. Connect from your personal Facebook profile (not while switched into the Page), and in the dialog tick the Page and its Instagram account, or choose all current and future Pages. If the Page is yours only through a business portfolio, the app also needs business_management.';

/**
 * Pages attached by id keep their place across a reconnect, but their tokens
 * are re-minted with the new user token (the old ones die when the app is
 * re-authorised or revoked, 2026-11-01). A Page that no longer answers is dropped.
 */
async function refreshAttachedPages(userToken: string, prev: MetaPageTarget[]): Promise<MetaPageTarget[]> {
  const out: MetaPageTarget[] = [];
  for (const t of prev) {
    if (!t.id) continue;
    try {
      const page = await facebookPageById(userToken, t.id);
      if (page) out.push({ id: page.id, name: page.name, tokenEnc: seal(page.accessToken), tasks: page.tasks, instagramUserId: page.instagramUserId, instagramUsername: page.instagramUsername });
    } catch {
      /* dropped: Facebook no longer gives this account the Page */
    }
  }
  return out;
}

/** Facebook: code → long-lived user token, the person, their Pages (with tokens) and Instagram accounts. */
async function completeMeta(userId: string, id: string, app: { appId: string; appSecret: string }, code: string) {
  const short = await facebookExchangeCode({ ...app, redirectUri: connectionRedirectUri(), code });
  const long = await facebookLongLivedToken(app, short.access_token);
  const me = await facebookMe(long.access_token);
  const pages = await facebookPages(long.access_token);
  let targets: MetaPageTarget[] = pages.map((p) => ({
    id: p.id,
    name: p.name,
    tokenEnc: seal(p.accessToken),
    tasks: p.tasks,
    instagramUserId: p.instagramUserId,
    instagramUsername: p.instagramUsername,
  }));
  // Facebook listed nothing: keep Pages attached by id (addMetaPage), whose
  // tokens stay valid until revoked, rather than wiping them (2026-11-01).
  if (targets.length === 0) {
    const prev = await db`SELECT targets FROM user_connections WHERE user_id = ${userId} AND id = ${id}`;
    targets = await refreshAttachedPages(long.access_token, (prev[0]?.targets ?? []) as MetaPageTarget[]);
  }
  await db`
    UPDATE user_connections SET
      refresh_token_enc = ${seal(long.access_token)},
      scopes = ${META_SCOPES},
      account_id = ${me.id},
      account_name = ${me.name},
      account_url = ${`https://www.facebook.com/${me.id}`},
      targets = ${db.json(targets as unknown as Parameters<typeof db.json>[0])},
      token_refreshed_at = now(),
      status = 'connected',
      error = ${targets.length === 0 ? NO_PAGE_ERROR : null},
      oauth_state = NULL, connected_at = now(), updated_at = now()
    WHERE user_id = ${userId} AND id = ${id}
  `;
}

/** Threads: code → long-lived token and the profile. */
async function completeThreads(userId: string, id: string, app: { appId: string; appSecret: string }, code: string) {
  const short = await threadsExchangeCode({ ...app, redirectUri: connectionRedirectUri(), code });
  const long = await threadsLongLivedToken(app.appSecret, short.access_token);
  const me = await threadsMe(long.access_token);
  await db`
    UPDATE user_connections SET
      refresh_token_enc = ${seal(long.access_token)},
      scopes = ${THREADS_SCOPES},
      account_id = ${String(me.id ?? short.user_id)},
      account_name = ${me.username ? `@${me.username}` : me.name ?? null},
      account_url = ${me.username ? `https://www.threads.net/@${me.username}` : null},
      targets = '[]'::jsonb,
      token_refreshed_at = now(),
      status = 'connected', error = NULL,
      oauth_state = NULL, connected_at = now(), updated_at = now()
    WHERE user_id = ${userId} AND id = ${id}
  `;
}

/** Instagram Login: code → long-lived token and the professional account. */
async function completeInstagram(userId: string, id: string, app: { appId: string; appSecret: string }, code: string) {
  const short = await instagramExchangeCode({ ...app, redirectUri: connectionRedirectUri(), code });
  const long = await instagramLongLivedToken(app.appSecret, short.access_token);
  const me = await instagramMe(long.access_token);
  const igId = String(me.user_id ?? me.id ?? short.user_id);
  await db`
    UPDATE user_connections SET
      refresh_token_enc = ${seal(long.access_token)},
      scopes = ${INSTAGRAM_SCOPES},
      account_id = ${igId},
      account_name = ${me.username ? `@${me.username}` : me.name ?? null},
      account_url = ${me.username ? `https://www.instagram.com/${me.username}` : null},
      targets = '[]'::jsonb,
      token_refreshed_at = now(),
      status = 'connected', error = NULL,
      oauth_state = NULL, connected_at = now(), updated_at = now()
    WHERE user_id = ${userId} AND id = ${id}
  `;
}

/**
 * Meta/Threads: the stored long-lived token, exchanged for a fresh one when it
 * is older than TOKEN_REFRESH_AFTER_MS. Not user-scoped (see getConnectionAccessToken).
 */
async function metaFamilyToken(id: string, force = false): Promise<ConnectionResult<{ accessToken: string; provider: ConnectionProvider; accountId: string | null }>> {
  const rows = await db`
    SELECT provider, client_id, client_secret_enc, refresh_token_enc, token_refreshed_at, account_id
    FROM user_connections WHERE id = ${id}
  `;
  const row = rows[0];
  if (!row?.refresh_token_enc) return { ok: false, error: 'Not connected.' };
  let token = open(row.refresh_token_enc);
  const age = row.token_refreshed_at ? Date.now() - new Date(row.token_refreshed_at).getTime() : Infinity;
  if (force || age > TOKEN_REFRESH_AFTER_MS) {
    try {
      const fresh =
        row.provider === 'meta'
          ? await facebookLongLivedToken({ appId: row.client_id, appSecret: open(row.client_secret_enc) }, token)
          : row.provider === 'instagram'
            ? await instagramRefreshToken(token)
            : await threadsRefreshToken(token);
      token = fresh.access_token;
      await db`UPDATE user_connections SET refresh_token_enc = ${seal(token)}, token_refreshed_at = now(), updated_at = now() WHERE id = ${id}`;
    } catch (err) {
      const error = `The connection no longer works (${err instanceof Error ? err.message : String(err)}). Connect again.`;
      await db`UPDATE user_connections SET status = 'error', error = ${error}, updated_at = now() WHERE id = ${id}`;
      return { ok: false, error };
    }
  }
  await db`UPDATE user_connections SET last_used_at = now() WHERE id = ${id}`;
  return { ok: true, accessToken: token, provider: row.provider, accountId: row.account_id ?? null };
}

/**
 * A Facebook Page target for publishing: the Page token and the linked
 * Instagram account. Not user-scoped; the caller decides the connection may
 * be used (it belongs to the acting user, or is an org's bound target).
 */
export async function getMetaPageTarget(
  connectionId: string,
  pageId: string
): Promise<ConnectionResult<{ pageId: string; accessToken: string; instagramUserId: string | null; name: string }>> {
  const rows = await db`SELECT provider, targets FROM user_connections WHERE id = ${connectionId}`;
  const row = rows[0];
  if (!row || row.provider !== 'meta') return { ok: false, error: 'Not a Facebook connection.' };
  const target = ((row.targets ?? []) as MetaPageTarget[]).find((t) => t.id === pageId);
  if (!target) return { ok: false, error: 'That Page is not on this connection. Reconnect to refresh the list.' };
  if (!(target.tasks ?? []).includes('CREATE_CONTENT')) return { ok: false, error: `Your role on ${target.name} does not allow posting.` };
  let accessToken: string;
  try {
    accessToken = open(target.tokenEnc);
  } catch {
    return { ok: false, error: 'The stored Page token cannot be read any more. Connect again.' };
  }
  await db`UPDATE user_connections SET last_used_at = now() WHERE id = ${connectionId}`;
  return { ok: true, pageId: target.id, accessToken, instagramUserId: target.instagramUserId ?? null, name: target.name };
}

/** An Instagram Login account for publishing: its user id and a usable token. */
export async function getInstagramLoginTarget(connectionId: string): Promise<ConnectionResult<{ userId: string; accessToken: string }>> {
  const t = await metaFamilyToken(connectionId);
  if (t.ok === false) return t;
  if (t.provider !== 'instagram' || !t.accountId) return { ok: false, error: 'Not an Instagram connection.' };
  return { ok: true, userId: t.accountId, accessToken: t.accessToken };
}

/** A Threads profile for publishing: its user id and a usable token. */
export async function getThreadsTarget(connectionId: string): Promise<ConnectionResult<{ userId: string; accessToken: string }>> {
  const t = await metaFamilyToken(connectionId);
  if (t.ok === false) return t;
  if (t.provider !== 'threads' || !t.accountId) return { ok: false, error: 'Not a Threads connection.' };
  return { ok: true, userId: t.accountId, accessToken: t.accessToken };
}

/**
 * The daily maintenance's handle on a Meta-family token (connection-maintenance.ts):
 * `force` exchanges it now whatever its age. System actor; no user scope.
 */
export async function refreshConnectionToken(id: string, opts: { force: boolean }): Promise<ConnectionResult<{ accessToken: string }>> {
  const t = await metaFamilyToken(id, opts.force);
  return t.ok === false ? t : { ok: true, accessToken: t.accessToken };
}

/**
 * A fresh access token for a connection. With `userId` the connection must
 * be that person's (every request-driven caller passes it, 2026-11-01);
 * without it the caller is a system actor (the upload worker running a
 * circle's bound publish target) and has already decided the connection may
 * be used.
 */
export async function getConnectionAccessToken(id: string, userId?: string): Promise<ConnectionResult<{ accessToken: string }>> {
  const rows = await db`
    SELECT provider, client_id, client_secret_enc, refresh_token_enc, user_id FROM user_connections WHERE id = ${id}
  `;
  const row = rows[0];
  if (!row || (userId && row.user_id !== userId)) return { ok: false, error: 'Not found.' };
  if (!row.refresh_token_enc) return { ok: false, error: 'Not connected.' };
  await resealLegacy(id);
  void logConnectionEvent({ userId: row.user_id, connectionId: id, provider: row.provider, event: 'token_used', detail: { by: userId ? 'person' : 'system' } });
  if (row.provider === 'meta' || row.provider === 'threads' || row.provider === 'instagram') {
    const t = await metaFamilyToken(id);
    return t.ok === false ? t : { ok: true, accessToken: t.accessToken };
  }
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: row.client_id,
      client_secret: open(row.client_secret_enc),
      refresh_token: open(row.refresh_token_enc),
      grant_type: 'refresh_token',
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    const error = data.error === 'invalid_grant'
      ? 'Google no longer accepts this connection (revoked or expired). Connect again.'
      : `Google refused: ${data.error_description ?? data.error ?? res.status}.`;
    await db`UPDATE user_connections SET status = 'error', error = ${error}, updated_at = now() WHERE id = ${id}`;
    return { ok: false, error };
  }
  await db`UPDATE user_connections SET last_used_at = now() WHERE id = ${id}`;
  return { ok: true, accessToken: data.access_token };
}

/** "1234567890", a facebook.com/<slug> URL, or profile.php?id=…: the id or slug Graph accepts. */
function parsePageRef(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/[?&]id=(\d{5,})/);
  if (m) return m[1]!;
  try {
    const u = new URL(t.includes('://') ? t : `https://${t}`);
    if (/facebook\.com$/i.test(u.hostname) || /fb\.com$/i.test(u.hostname)) {
      const seg = u.pathname.split('/').filter(Boolean)[0];
      return seg && /^[A-Za-z0-9.\-_]+$/.test(seg) && seg !== 'profile.php' ? seg : null;
    }
  } catch {
    /* not a URL */
  }
  return /^[A-Za-z0-9.\-_]{2,100}$/.test(t) ? t : null;
}

/**
 * Attach a Page to a Facebook connection by id or URL (2026-11-01): for a
 * person whose Page list comes back empty although they administer the
 * Page. Facebook still vouches: without a role there is no Page token.
 */
export async function addMetaPage(userId: string, id: string, pageRef: string): Promise<ConnectionResult<{ connection: UserConnection }>> {
  const mine = await getConnection(userId, id);
  if (!mine) return { ok: false, error: 'Not found.' };
  if (mine.provider !== 'meta') return { ok: false, error: 'Only a Facebook connection takes a Page.' };
  const ref = parsePageRef(pageRef);
  if (!ref) return { ok: false, error: 'Give the Page id (a number) or its facebook.com address.' };
  const token = await getConnectionAccessToken(id, userId);
  if (token.ok === false) return token;
  let page: Awaited<ReturnType<typeof facebookPageById>>;
  try {
    page = await facebookPageById(token.accessToken, ref);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!page) return { ok: false, error: 'Facebook knows that Page but gives this account no role on it (no Page token came back).' };
  const rows = await db`SELECT targets FROM user_connections WHERE id = ${id}`;
  const existing = ((rows[0]?.targets ?? []) as MetaPageTarget[]).filter((t) => t.id !== page!.id);
  const targets: MetaPageTarget[] = [
    ...existing,
    { id: page.id, name: page.name, tokenEnc: seal(page.accessToken), tasks: page.tasks, instagramUserId: page.instagramUserId, instagramUsername: page.instagramUsername },
  ];
  await db`
    UPDATE user_connections SET targets = ${db.json(targets as unknown as Parameters<typeof db.json>[0])}, error = NULL, status = 'connected', updated_at = now()
    WHERE user_id = ${userId} AND id = ${id}
  `;
  void logConnectionEvent({ userId, connectionId: id, provider: 'meta', event: 'page_attached', detail: { pageId: page.id, name: page.name } });
  return { ok: true, connection: (await getConnection(userId, id))! };
}

/**
 * Make one of this connection's accounts an org's channel, or stop (2026-11-01).
 * The account must be on the person's own connection: a Page target, or the
 * connection's own account for Instagram Login, Threads and YouTube.
 */
export async function setConnectionChannel(
  userId: string,
  id: string,
  input: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const mine = await getConnection(userId, id);
  if (!mine) return { ok: false, error: 'Not found.' };
  const orgId = typeof input.orgId === 'string' ? input.orgId : '';
  const externalId = typeof input.externalId === 'string' ? input.externalId : '';
  const on = input.on !== false;
  if (!orgId || !externalId) return { ok: false, error: 'Bad request.' };
  let provider: ChannelProvider;
  let label = '';
  if (mine.provider === 'meta') {
    const page = mine.targets.find((t) => t.id === externalId);
    if (!page) return { ok: false, error: 'That Page is not on this connection.' };
    provider = 'meta';
    label = page.name;
  } else {
    if (mine.accountId !== externalId) return { ok: false, error: 'That account is not on this connection.' };
    provider = mine.provider as ChannelProvider;
    label = mine.accountName ?? '';
  }
  const r = await setOrgChannel(userId, { orgId, provider, externalId, label, on });
  if (r.ok) void logConnectionEvent({ userId, connectionId: id, provider: mine.provider, event: on ? 'channel_set' : 'channel_cleared', detail: { orgId, externalId } });
  return r;
}

/** Re-read the channel name with a fresh token: a "Test" button. */
export async function checkConnection(userId: string, id: string): Promise<ConnectionResult<{ connection: UserConnection }>> {
  const mine = await getConnection(userId, id);
  if (!mine) return { ok: false, error: 'Not found.' };
  void logConnectionEvent({ userId, connectionId: id, provider: mine.provider, event: 'tested' });
  const token = await getConnectionAccessToken(id, userId);
  if (token.ok === false) return token;
  if (mine.provider === 'meta') {
    try {
      const me = await facebookMe(token.accessToken);
      const pages = await facebookPages(token.accessToken);
      let targets: MetaPageTarget[] = pages.map((p) => ({
        id: p.id, name: p.name, tokenEnc: seal(p.accessToken), tasks: p.tasks,
        instagramUserId: p.instagramUserId, instagramUsername: p.instagramUsername,
      }));
      // As in completeMeta: an empty list keeps the Pages attached by id.
      if (targets.length === 0) {
        const prev = await db`SELECT targets FROM user_connections WHERE id = ${id}`;
        targets = await refreshAttachedPages(token.accessToken, (prev[0]?.targets ?? []) as MetaPageTarget[]);
      }
      await db`
        UPDATE user_connections SET account_id = ${me.id}, account_name = ${me.name}, targets = ${db.json(targets as unknown as Parameters<typeof db.json>[0])},
          status = 'connected', error = ${targets.length === 0 ? NO_PAGE_ERROR : null}, updated_at = now()
        WHERE user_id = ${userId} AND id = ${id}
      `;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    return { ok: true, connection: (await getConnection(userId, id))! };
  }
  if (mine.provider === 'instagram') {
    try {
      const me = await instagramMe(token.accessToken);
      await db`
        UPDATE user_connections SET account_id = ${String(me.user_id ?? me.id ?? mine.accountId)}, account_name = ${me.username ? `@${me.username}` : me.name ?? null},
          account_url = ${me.username ? `https://www.instagram.com/${me.username}` : null}, status = 'connected', error = NULL, updated_at = now()
        WHERE user_id = ${userId} AND id = ${id}
      `;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    return { ok: true, connection: (await getConnection(userId, id))! };
  }
  if (mine.provider === 'threads') {
    try {
      const me = await threadsMe(token.accessToken);
      await db`
        UPDATE user_connections SET account_id = ${String(me.id)}, account_name = ${me.username ? `@${me.username}` : me.name ?? null},
          account_url = ${me.username ? `https://www.threads.net/@${me.username}` : null}, status = 'connected', error = NULL, updated_at = now()
        WHERE user_id = ${userId} AND id = ${id}
      `;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    return { ok: true, connection: (await getConnection(userId, id))! };
  }
  const { channel, error: channelError } = await fetchOwnChannel(token.accessToken);
  await db`
    UPDATE user_connections SET
      account_id = ${channel?.id ?? null}, account_name = ${channel?.title ?? null},
      account_url = ${channel ? (channel.customUrl ? `https://www.youtube.com/${channel.customUrl}` : `https://www.youtube.com/channel/${channel.id}`) : null},
      status = 'connected',
      error = ${channelError},
      updated_at = now()
    WHERE user_id = ${userId} AND id = ${id}
  `;
  return { ok: true, connection: (await getConnection(userId, id))! };
}

// ── HTTP handlers (Web Request/Response, mounted by each app) ───────────────

/**
 * GET/POST/PATCH/DELETE for a "Connections" panel, e.g. /api/center/connections.
 * `getUserId` resolves the acting user from the app's session.
 *
 *   GET                         → { connections, redirectUri }
 *   POST   {provider,label,clientId,clientSecret}  → { connection }   (meta/threads: provider and label only)
 *   PATCH  {id,label?,clientId?,clientSecret?} | {id, check:true} → { connection }
 *   DELETE ?id=                 → { ok }
 */
export function connectionsHandlers(getUserId: () => Promise<string | null>) {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const who = async () => (await getUserId().catch(() => null)) ?? null;

  return {
    async GET() {
      const userId = await who();
      if (!userId) return json({ error: 'Sign in first' }, 401);
      // The orgs this person may set channels for, and those orgs' channels (2026-11-01).
      const [connections, memberships, channels, events] = await Promise.all([
        listConnections(userId),
        listUserMemberships(userId).catch(() => []),
        listChannelsForManager(userId).catch(() => []),
        listConnectionEvents(userId, 30),
      ]);
      const orgs = memberships.filter((m) => m.role === 'owner' || m.role === 'guide').map((m) => ({ orgId: m.orgId, name: m.orgName }));
      return json({ connections, redirectUri: connectionRedirectUri(), youtubeCollective: Boolean(youtubeApp()), orgs, channels, events });
    },
    async POST(request: Request) {
      const userId = await who();
      if (!userId) return json({ error: 'Sign in first' }, 401);
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return json({ error: 'Bad request' }, 400);
      const r = await createConnection(userId, body);
      if (r.ok === false) return json({ error: r.error }, 400);
      void logConnectionEvent({ userId, connectionId: r.connection.id, provider: r.connection.provider, event: 'created' });
      return json({ connection: r.connection });
    },
    async PATCH(request: Request) {
      const userId = await who();
      if (!userId) return json({ error: 'Sign in first' }, 401);
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body.id !== 'string') return json({ error: 'Bad request' }, 400);
      if (body.channel && typeof body.channel === 'object') {
        const r = await setConnectionChannel(userId, body.id, body.channel as Record<string, unknown>);
        if (r.ok === false) return json({ error: r.error }, 400);
        return json({ ok: true });
      }
      const r = body.check
        ? await checkConnection(userId, body.id)
        : typeof body.addPage === 'string'
          ? await addMetaPage(userId, body.id, body.addPage)
          : await updateConnection(userId, body.id, body);
      if (r.ok === false) return json({ error: r.error }, 400);
      return json({ connection: r.connection });
    },
    async DELETE(request: Request) {
      const userId = await who();
      if (!userId) return json({ error: 'Sign in first' }, 401);
      const id = new URL(request.url).searchParams.get('id');
      if (!id) return json({ error: 'Bad request' }, 400);
      return (await deleteConnection(userId, id)) ? json({ ok: true }) : json({ error: 'Not found' }, 404);
    },
  };
}
