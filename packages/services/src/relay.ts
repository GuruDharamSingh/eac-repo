/**
 * The stream relay (docker/relay, 2026-11-01): the server OBS publishes its
 * program once to the relay, and the relay agent copies it to every armed
 * destination; feeds in (Zoom, a phone, another OBS) publish to
 * rtmp://relay:1935/in/<key> and OBS reads them as sources.
 *
 * Import as `@elkdonis/services/relay` from server code only: it carries the
 * relay agent secret and unseals stream keys. Callers gate on users.is_admin.
 *
 * Destinations live in stream_destinations (migration 226) with the stream
 * key sealed by CONNECTIONS_KEY; keys are unsealed only in armRelay() and
 * never returned to a client. History in stream_events.
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { db } from '@elkdonis/db';

const URL_ = (process.env.RELAY_AGENT_URL ?? '').replace(/\/$/, '');
const SECRET = process.env.RELAY_AGENT_SECRET ?? '';

// ── relay agent ─────────────────────────────────────────────────────────────

export type RelayOutputState = 'waiting' | 'connecting' | 'live' | 'retrying' | 'stopped';

export interface RelayOutput {
  id: string;
  label: string;
  /** protocol://host:port only; the key is never reported. */
  host: string;
  state: RelayOutputState;
  since: string;
  retries: number;
  lastError: string | null;
  bytes: number;
  liveSeconds: number;
}

export interface RelayPath {
  ready: boolean;
  since?: string | null;
  tracks?: string[];
  bytesReceived?: number;
  readers?: number;
}

export interface RelayFeed extends RelayPath {
  key: string;
  label: string;
  createdAt: string;
}

export interface RelayEvent {
  at: string;
  event: string;
  label?: string;
  host?: string;
  error?: string;
}

export interface RelayStatus {
  connected: boolean;
  program?: RelayPath;
  outputs?: RelayOutput[];
  feeds?: RelayFeed[];
  events?: RelayEvent[];
}

export function relayConfigured(): boolean {
  return Boolean(URL_ && SECRET);
}

async function agent<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (!relayConfigured()) throw new Error('The stream relay is not configured on this server');
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  } as Parameters<typeof fetch>[1]);
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Relay agent ${res.status}`);
  return data as T;
}

export async function relayStatus(): Promise<RelayStatus> {
  try {
    return { connected: true, ...(await agent<Omit<RelayStatus, 'connected'>>('GET', '/status')) };
  } catch {
    return { connected: false };
  }
}

export const relayStopOutputs = () => agent<{ outputs: RelayOutput[] }>('POST', '/outputs/stop').then((r) => r.outputs);
export const relayAddFeed = (label: string) => agent<RelayFeed>('POST', '/feeds', { label });
export const relayRemoveFeed = (key: string) => agent('POST', '/feeds/delete', { key });

// ── sealing ─────────────────────────────────────────────────────────────────

/** AES-256-GCM, key derived from CONNECTIONS_KEY. "s1.<iv>.<tag>.<ciphertext>". */
function sealKey(): Buffer {
  const secret = process.env.CONNECTIONS_KEY;
  if (!secret) throw new Error('CONNECTIONS_KEY is not set in this container; stream keys cannot be stored.');
  return Buffer.from(hkdfSync('sha256', secret, 'eac-relay', 'stream_destinations v1', 32));
}

function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', sealKey(), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['s1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

function unseal(sealed: string): string {
  const [v, iv, tag, body] = sealed.split('.');
  if (v !== 's1' || !iv || !tag || body === undefined) throw new Error('Unreadable stored stream key.');
  const d = createDecipheriv('aes-256-gcm', sealKey(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
}

// ── destinations ────────────────────────────────────────────────────────────

export type StreamPreset = 'youtube' | 'facebook' | 'twitch' | 'kick' | 'custom';

/**
 * Ingest servers for the presets; custom takes the server the platform gives.
 * `server: null` is a platform that gives each account its own server (Kick,
 * on Amazon IVS), so the form asks for it like custom. Twitch's is the
 * "Default" row of https://ingest.twitch.tv/ingests (checked 2026-11-01).
 */
export const STREAM_PRESETS: Record<Exclude<StreamPreset, 'custom'>, { label: string; server: string | null }> = {
  youtube: { label: 'YouTube Live', server: 'rtmp://a.rtmp.youtube.com/live2' },
  facebook: { label: 'Facebook Live', server: 'rtmps://live-api-s.facebook.com:443/rtmp/' },
  twitch: { label: 'Twitch', server: 'rtmps://ingest.global-contribute.live-video.net:443/app' },
  kick: { label: 'Kick', server: null },
};

function isPreset(p: unknown): p is Exclude<StreamPreset, 'custom'> {
  return typeof p === 'string' && Object.prototype.hasOwnProperty.call(STREAM_PRESETS, p);
}

export interface StreamDestination {
  id: string;
  label: string;
  preset: StreamPreset;
  server: string;
  /** Last four characters of the key, for recognising it. */
  keyHint: string;
  enabled: boolean;
  /**
   * Whose chat the stream-chat service follows (migration 228): a Twitch
   * login or Kick slug; for YouTube, the channel id (UC…) of a connected
   * YouTube account, whose connection reads the chat.
   */
  chatChannel: string | null;
  updatedAt: string;
}

/**
 * "https://www.twitch.tv/Some_Name", "#some_name" or "some_name" → "some_name".
 * YouTube takes a channel id ("UC" + 22 characters). Facebook and custom
 * destinations get null.
 */
export function normalizeChatChannel(preset: StreamPreset, raw: string | null | undefined): string | null {
  if (preset === 'youtube') {
    const id = String(raw ?? '').trim().replace(/^https?:\/\/(www\.)?youtube\.com\/channel\//, '').replace(/[/?#].*$/, '');
    if (!id) return null;
    if (!/^UC[A-Za-z0-9_-]{22}$/.test(id)) throw new Error('That does not look like a YouTube channel id');
    return id;
  }
  if (preset !== 'twitch' && preset !== 'kick') return null;
  let v = String(raw ?? '').trim().toLowerCase();
  if (!v) return null;
  v = v.replace(/^https?:\/\/(www\.)?(twitch\.tv|kick\.com)\//, '').replace(/^[#@]/, '').replace(/[/?#].*$/, '');
  const ok = preset === 'twitch' ? /^[a-z0-9_]{3,25}$/ : /^[a-z0-9_-]{3,25}$/;
  if (!ok.test(v)) throw new Error(`That does not look like a ${preset === 'twitch' ? 'Twitch' : 'Kick'} channel name`);
  return v;
}

function mapDestination(r: any): StreamDestination {
  let hint = '';
  try {
    hint = unseal(r.key_enc).slice(-4);
  } catch {
    hint = '????';
  }
  return {
    id: r.id,
    label: r.label,
    preset: isPreset(r.preset) ? r.preset : 'custom',
    server: r.server,
    keyHint: hint,
    enabled: r.enabled,
    chatChannel: r.chat_channel ?? null,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function listStreamDestinations(): Promise<StreamDestination[]> {
  const rows = await db`SELECT * FROM stream_destinations ORDER BY created_at`;
  return rows.map(mapDestination);
}

function checkServer(server: string): string {
  const s = server.trim();
  if (!/^rtmps?:\/\/[^\s/]+/i.test(s) || s.length > 500) throw new Error('The server must start with rtmp:// or rtmps://');
  return s;
}

export interface StreamDestinationInput {
  id?: string;
  label: string;
  preset: StreamPreset;
  /** Required for custom and Kick; the other presets use their own server. */
  server?: string;
  /** Required on create; on update, blank keeps the stored key. */
  key?: string;
  enabled?: boolean;
  /** Twitch and Kick: the channel whose chat to collect; blank for none. */
  chatChannel?: string | null;
}

export async function saveStreamDestination(userId: string, input: StreamDestinationInput): Promise<StreamDestination> {
  const preset: StreamPreset = isPreset(input.preset) ? input.preset : 'custom';
  const fixed = preset === 'custom' ? null : STREAM_PRESETS[preset].server;
  const server = fixed ?? checkServer(input.server ?? '');
  if (preset === 'kick' && !server.toLowerCase().startsWith('rtmps://')) throw new Error('Kick\'s server starts with rtmps://; copy it from the Kick dashboard');
  const label = (input.label ?? '').trim().slice(0, 60) || (preset === 'custom' ? new URL(server).host : STREAM_PRESETS[preset].label);
  const key = (input.key ?? '').trim();
  if (key.length > 500 || /\s/.test(key)) throw new Error('That stream key does not look right');
  const enabled = input.enabled ?? true;
  const chat = normalizeChatChannel(preset, input.chatChannel);

  if (!input.id) {
    if (!key) throw new Error('Paste the stream key');
    const rows = await db`
      INSERT INTO stream_destinations (label, preset, server, key_enc, enabled, chat_channel, set_by)
      VALUES (${label}, ${preset}, ${server}, ${seal(key)}, ${enabled}, ${chat}, ${userId})
      RETURNING *
    `;
    await streamEvent(userId, 'destination_added', rows[0].id, { label, preset });
    return mapDestination(rows[0]);
  }
  const rows = key
    ? await db`
        UPDATE stream_destinations SET label = ${label}, preset = ${preset}, server = ${server}, key_enc = ${seal(key)},
          enabled = ${enabled}, chat_channel = ${chat}, set_by = ${userId}, updated_at = now()
        WHERE id = ${input.id} RETURNING *
      `
    : await db`
        UPDATE stream_destinations SET label = ${label}, preset = ${preset}, server = ${server},
          enabled = ${enabled}, chat_channel = ${chat}, set_by = ${userId}, updated_at = now()
        WHERE id = ${input.id} RETURNING *
      `;
  if (!rows[0]) throw new Error('That destination is gone');
  await streamEvent(userId, 'destination_updated', input.id, { label, keyChanged: Boolean(key) });
  return mapDestination(rows[0]);
}

export async function setStreamDestinationEnabled(id: string, enabled: boolean): Promise<void> {
  await db`UPDATE stream_destinations SET enabled = ${enabled}, updated_at = now() WHERE id = ${id}`;
}

export async function removeStreamDestination(userId: string, id: string): Promise<void> {
  const rows = await db`DELETE FROM stream_destinations WHERE id = ${id} RETURNING label`;
  if (rows[0]) await streamEvent(userId, 'destination_removed', id, { label: rows[0].label });
}

/** server + key as one RTMP address: "rtmp://a.rtmp.youtube.com/live2" + "abcd" → ".../live2/abcd". */
function joinUrl(server: string, key: string): string {
  return `${server.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
}

/**
 * Arm the relay with every enabled destination (keys unsealed here, sent to
 * the agent, held in its memory). Returns the outputs as the agent reports them.
 */
export async function armRelay(): Promise<RelayOutput[]> {
  const rows = await db`SELECT * FROM stream_destinations WHERE enabled ORDER BY created_at`;
  if (rows.length === 0) throw new Error('Tick at least one destination');
  const outputs = rows.map((r: any) => ({ id: r.id, label: r.label, url: joinUrl(r.server, unseal(r.key_enc)) }));
  const res = await agent<{ outputs: RelayOutput[] }>('POST', '/outputs', { outputs });
  return res.outputs;
}

// ── events ──────────────────────────────────────────────────────────────────

export interface StreamEventRow {
  at: string;
  event: string;
  userName: string | null;
  detail: Record<string, unknown>;
}

/** Best effort: a missing table (migration 226 not applied) never stops a broadcast. */
export async function streamEvent(userId: string | null, event: string, destinationId: string | null, detail: Record<string, unknown> = {}): Promise<void> {
  try {
    await db`
      INSERT INTO stream_events (user_id, event, destination_id, detail)
      VALUES (${userId}, ${event}, ${destinationId}, ${db.json(detail as Parameters<typeof db.json>[0])})
    `;
  } catch (err) {
    console.warn('[relay] event not recorded:', err instanceof Error ? err.message : String(err));
  }
}

export async function listStreamEvents(limit = 20): Promise<StreamEventRow[]> {
  const rows = await db`
    SELECT e.at, e.event, e.detail, u.display_name
    FROM stream_events e LEFT JOIN users u ON u.id = e.user_id
    ORDER BY e.at DESC LIMIT ${Math.min(Math.max(limit, 1), 100)}
  `;
  return rows.map((r: any) => ({
    at: new Date(r.at).toISOString(),
    event: r.event,
    userName: r.display_name ?? null,
    detail: (r.detail ?? {}) as Record<string, unknown>,
  }));
}
