/**
 * Chat from the stream's destinations, in one place (2026-11-01, migration
 * 228). The stream-chat service (scripts/stream-chat.mts) follows every
 * ticked destination that names a chat channel and writes viewer messages to
 * stream_chat_messages; the Studio's Chat panel reads them here.
 *
 * Phase 1 is Twitch: anonymous IRC (no account), so only reading. Phase 2
 * is YouTube: the destination names the channel id of a connected YouTube
 * account (user_connections, youtube.readonly), and the collector reads that
 * channel's active broadcast's chat with the connection's token while the
 * destination is part of the current go live. Plan and later phases
 * (Facebook, Kick): docs/open/BROADCAST_BOOTH_AND_RELAY_PLAN_2026-11-01.md.
 *
 * Server code only; callers gate on users.is_admin.
 */

import { db } from '@elkdonis/db';

export type ChatPlatform = 'twitch' | 'youtube' | 'facebook' | 'kick';

export interface StreamChatMessage {
  id: number;
  platform: ChatPlatform;
  channel: string;
  author: string;
  body: string;
  /** The author's name colour on the platform, when it sends one ("#1E90FF"). */
  colour: string | null;
  /** A paid message's amount as the platform shows it (YouTube Super Chat: "CA$5.00"). */
  amount: string | null;
  sentAt: string;
}

export interface ChatChannel {
  destinationId: string;
  platform: ChatPlatform;
  channel: string;
}

/** Messages after `sinceId`; without it, the last `limit` from the past 6 hours. Oldest first. */
export async function listStreamChat(sinceId?: number | null, limit = 100): Promise<StreamChatMessage[]> {
  const n = Math.min(Math.max(1, limit), 300);
  const rows = sinceId
    ? await db`
        SELECT * FROM stream_chat_messages WHERE id > ${sinceId} ORDER BY id LIMIT ${n}
      `
    : await db`
        SELECT * FROM (
          SELECT * FROM stream_chat_messages WHERE received_at > now() - interval '6 hours'
          ORDER BY id DESC LIMIT ${n}
        ) t ORDER BY id
      `;
  return rows.map(toMessage);
}

/**
 * The broadcast overlay's window (graphic eac-chat, through the collector's
 * /recent): the newest `limit` messages received in the past `minutes`,
 * oldest first. Deleted messages are simply absent on the next read.
 */
export async function recentStreamChat(minutes: number, limit: number): Promise<StreamChatMessage[]> {
  const m = Math.min(Math.max(1, Math.round(minutes) || 10), 720);
  const n = Math.min(Math.max(1, Math.round(limit) || 20), 100);
  const rows = await db`
    SELECT * FROM (
      SELECT * FROM stream_chat_messages WHERE received_at > now() - make_interval(mins => ${m})
      ORDER BY id DESC LIMIT ${n}
    ) t ORDER BY id
  `;
  return rows.map(toMessage);
}

function toMessage(r: any): StreamChatMessage {
  return {
    id: Number(r.id),
    platform: r.platform,
    channel: r.channel,
    author: r.author,
    body: r.body,
    colour: typeof r.meta?.colour === 'string' ? r.meta.colour : null,
    amount: typeof r.meta?.amount === 'string' ? r.meta.amount : null,
    sentAt: new Date(r.sent_at).toISOString(),
  };
}

/** The channels to follow: ticked destinations that name one. */
export async function chatChannels(): Promise<ChatChannel[]> {
  const rows = await db`
    SELECT id, preset, chat_channel FROM stream_destinations
    WHERE enabled AND chat_channel IS NOT NULL AND preset IN ('twitch', 'kick', 'youtube')
    ORDER BY created_at
  `;
  return rows.map((r: any) => ({ destinationId: r.id, platform: r.preset, channel: r.chat_channel }));
}

/**
 * Destinations in the current go live: the outputs of the last go_live, if
 * no stop followed it within 12 hours (stream_events, written by the Studio's
 * relay actions). YouTube chat is read only for these, to spare the quota.
 */
export async function liveDestinationIds(): Promise<Set<string>> {
  const rows = await db`
    SELECT event, detail FROM stream_events
    WHERE event IN ('go_live', 'stop') AND at > now() - interval '12 hours'
    ORDER BY id DESC LIMIT 1
  `;
  const r = rows[0];
  if (!r || r.event !== 'go_live' || !Array.isArray(r.detail?.outputs)) return new Set();
  return new Set(r.detail.outputs.map((o: any) => String(o?.id ?? '')).filter(Boolean));
}

/** The connected YouTube connection for a channel id, newest first; the collector reads chat with its token. */
export async function youtubeConnectionFor(channelId: string): Promise<string | null> {
  const rows = await db`
    SELECT id FROM user_connections
    WHERE provider = 'youtube' AND status = 'connected' AND account_id = ${channelId} AND refresh_token_enc IS NOT NULL
    ORDER BY connected_at DESC NULLS LAST LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

export interface ChatSource {
  platform: 'youtube';
  channelId: string;
  name: string;
}

/** A person's connected YouTube channels: what a YouTube destination may take its chat from. */
export async function youtubeChatSources(userId: string): Promise<ChatSource[]> {
  const rows = await db`
    SELECT DISTINCT ON (account_id) account_id, account_name FROM user_connections
    WHERE user_id = ${userId} AND provider = 'youtube' AND status = 'connected' AND account_id IS NOT NULL
    ORDER BY account_id, connected_at DESC NULLS LAST
  `;
  return rows.map((r: any) => ({ platform: 'youtube' as const, channelId: r.account_id, name: r.account_name || r.account_id }));
}

export interface IncomingChat {
  destinationId: string | null;
  platform: ChatPlatform;
  channel: string;
  externalId: string;
  author: string;
  authorId?: string | null;
  body: string;
  meta?: Record<string, unknown>;
  sentAt: Date;
}

export async function saveChat(m: IncomingChat): Promise<void> {
  await db`
    INSERT INTO stream_chat_messages (destination_id, platform, channel, external_id, author, author_id, body, meta, sent_at)
    VALUES (${m.destinationId}, ${m.platform}, ${m.channel}, ${m.externalId}, ${m.author.slice(0, 100)},
      ${m.authorId ?? null}, ${m.body.slice(0, 2000)}, ${db.json((m.meta ?? {}) as any)}, ${m.sentAt})
    ON CONFLICT (platform, external_id) DO NOTHING
  `;
}

/** A moderator deleted one message, or timed out / banned a viewer (all their messages). */
export async function removeChat(platform: ChatPlatform, by: { externalId: string } | { channel: string; authorId: string }): Promise<void> {
  if ('externalId' in by) {
    await db`DELETE FROM stream_chat_messages WHERE platform = ${platform} AND external_id = ${by.externalId}`;
  } else {
    await db`DELETE FROM stream_chat_messages WHERE platform = ${platform} AND channel = ${by.channel} AND author_id = ${by.authorId}`;
  }
}

/** Keep 30 days. */
export async function pruneChat(): Promise<number> {
  const rows = await db`DELETE FROM stream_chat_messages WHERE received_at < now() - interval '30 days' RETURNING id`;
  return rows.length;
}
