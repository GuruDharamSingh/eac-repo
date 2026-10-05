/**
 * Connections — a person's own OAuth links to outside services (migration 192).
 *
 * YouTube first. The person brings their own Google Cloud OAuth client: they
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
import { nanoid } from 'nanoid';

export type ConnectionProvider = 'youtube';
export type ConnectionStatus = 'pending' | 'connected' | 'error';

/** What a form may see. No secret, no token. */
export interface UserConnection {
  id: string;
  provider: ConnectionProvider;
  label: string;
  /** The client id is not a secret; shown so the person can tell clients apart. */
  clientId: string;
  status: ConnectionStatus;
  error: string | null;
  accountId: string | null;
  accountName: string | null;
  accountUrl: string | null;
  connectedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
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
};

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE = 'https://oauth2.googleapis.com/revoke';
const YT_CHANNELS = 'https://www.googleapis.com/youtube/v3/channels';
/** How long a started authorisation stays valid. */
const STATE_TTL_MS = 15 * 60 * 1000;

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

function key(): Buffer {
  const secret = process.env.INTER_APP_JWT_SECRET;
  if (!secret) throw new Error('INTER_APP_JWT_SECRET is not set; connections cannot store secrets.');
  return Buffer.from(hkdfSync('sha256', secret, 'eac-connections', 'user_connections v1', 32));
}

/** "v1.<iv>.<tag>.<ciphertext>", base64url parts. */
function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

function open(sealed: string): string {
  const [v, iv, tag, body] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || body === undefined) throw new Error('Unreadable stored secret.');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
}

// ── rows ────────────────────────────────────────────────────────────────────

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

function mapRow(r: any): UserConnection {
  return {
    id: r.id,
    provider: r.provider,
    label: r.label ?? '',
    clientId: r.client_id,
    status: r.status,
    error: r.error ?? null,
    accountId: r.account_id ?? null,
    accountName: r.account_name ?? null,
    accountUrl: r.account_url ?? null,
    connectedAt: iso(r.connected_at),
    lastUsedAt: iso(r.last_used_at),
    createdAt: iso(r.created_at)!,
  };
}

const COLUMNS = db`
  id, provider, label, client_id, status, error, account_id, account_name,
  account_url, connected_at, last_used_at, created_at
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
  const provider = input.provider ?? 'youtube';
  if (provider !== 'youtube') return { ok: false, error: 'Only YouTube can be connected so far.' };
  const { label, clientId, clientSecret } = cleanInput(input);
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
    RETURNING refresh_token_enc
  `;
  if (!rows[0]) return false;
  // Best effort: tell Google the token is no longer wanted.
  const sealed = rows[0].refresh_token_enc as string | null;
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
  if (params.error) return fail(params.error === 'access_denied' ? 'Access was not granted at Google.' : `Google said: ${params.error}`);
  if (!params.code) return fail('Google returned no code.');

  let clientSecret: string;
  try {
    clientSecret = open(row.client_secret_enc);
  } catch {
    return fail('The stored client secret cannot be read any more. Enter it again.');
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
 * A fresh access token for a connection, for server-side work (uploads).
 * Not scoped to a user: callers must already have decided the connection may
 * be used (e.g. it is a circle's bound publish target).
 */
export async function getConnectionAccessToken(id: string): Promise<ConnectionResult<{ accessToken: string }>> {
  const rows = await db`
    SELECT client_id, client_secret_enc, refresh_token_enc FROM user_connections WHERE id = ${id}
  `;
  const row = rows[0];
  if (!row?.refresh_token_enc) return { ok: false, error: 'Not connected.' };
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

/** Re-read the channel name with a fresh token: a "Test" button. */
export async function checkConnection(userId: string, id: string): Promise<ConnectionResult<{ connection: UserConnection }>> {
  const mine = await getConnection(userId, id);
  if (!mine) return { ok: false, error: 'Not found.' };
  const token = await getConnectionAccessToken(id);
  if (token.ok === false) return token;
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
 *   POST   {provider,label,clientId,clientSecret}  → { connection }
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
      return json({ connections: await listConnections(userId), redirectUri: connectionRedirectUri() });
    },
    async POST(request: Request) {
      const userId = await who();
      if (!userId) return json({ error: 'Sign in first' }, 401);
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return json({ error: 'Bad request' }, 400);
      const r = await createConnection(userId, body);
      if (r.ok === false) return json({ error: r.error }, 400);
      return json({ connection: r.connection });
    },
    async PATCH(request: Request) {
      const userId = await who();
      if (!userId) return json({ error: 'Sign in first' }, 401);
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body.id !== 'string') return json({ error: 'Bad request' }, 400);
      const r = body.check ? await checkConnection(userId, body.id) : await updateConnection(userId, body.id, body);
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
