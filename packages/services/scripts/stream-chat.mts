/**
 * The stream-chat collector (2026-11-01, migration 228). Runs in container
 * eac-stream-chat:
 *
 *   node_modules/.bin/tsx scripts/stream-chat.mts
 *
 * Every STREAM_CHAT_SCAN_SECONDS (default 15) it reads which destinations
 * name a chat channel (ticked ones only) and joins or leaves them. Twitch:
 * anonymous IRC over TLS (irc.chat.twitch.tv:6697, a justinfan nick), read
 * only; PRIVMSG becomes a row, CLEARMSG / CLEARCHAT remove what moderators
 * removed. YouTube: only for destinations in the current go live, the
 * channel's active broadcast is looked up once a minute until found, then its
 * chat is read every STREAM_CHAT_YOUTUBE_SECONDS (default 10) or slower when
 * YouTube asks; quota: 1 unit per lookup, 5 per read, 10,000 per day. Once
 * an hour, messages older than 30 days are deleted.
 *
 * It also answers GET /recent?minutes=&limit= on STREAM_CHAT_PORT (default
 * 4459, eac-network only, nothing published) with the newest messages: the
 * OBS agent passes this to the broadcast chat overlay (graphic eac-chat).
 * See packages/services/src/stream-chat.ts.
 */
import { createServer } from 'node:http';
import tls from 'node:tls';
import { getConnectionAccessToken } from '../src/connections.ts';
import {
  chatChannels,
  liveDestinationIds,
  pruneChat,
  recentStreamChat,
  removeChat,
  saveChat,
  youtubeConnectionFor,
  type ChatChannel,
} from '../src/stream-chat.ts';

const SCAN_MS = Math.max(5, Number(process.env.STREAM_CHAT_SCAN_SECONDS || 15)) * 1000;
const YT_MIN_MS = Math.max(5, Number(process.env.STREAM_CHAT_YOUTUBE_SECONDS || 10)) * 1000;
const PORT = Number(process.env.STREAM_CHAT_PORT) || 4459;
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

let stopping = false;

// ── Twitch ───────────────────────────────────────────────────────────────────

/** IRCv3 tag values escape ; space \ CR LF. */
function unescapeTag(v: string): string {
  return v.replace(/\\(.)/g, (_, c) => ({ ':': ';', s: ' ', '\\': '\\', r: '\r', n: '\n' } as Record<string, string>)[c] ?? c);
}

interface IrcLine {
  tags: Record<string, string>;
  command: string;
  params: string[];
}

function parseIrc(line: string): IrcLine | null {
  let rest = line;
  const tags: Record<string, string> = {};
  if (rest.startsWith('@')) {
    const sp = rest.indexOf(' ');
    for (const kv of rest.slice(1, sp).split(';')) {
      const eq = kv.indexOf('=');
      tags[eq < 0 ? kv : kv.slice(0, eq)] = eq < 0 ? '' : unescapeTag(kv.slice(eq + 1));
    }
    rest = rest.slice(sp + 1);
  }
  if (rest.startsWith(':')) rest = rest.slice(rest.indexOf(' ') + 1);
  const trailingAt = rest.indexOf(' :');
  const head = trailingAt >= 0 ? rest.slice(0, trailingAt) : rest;
  const params = head.split(' ').filter(Boolean);
  const command = params.shift();
  if (!command) return null;
  if (trailingAt >= 0) params.push(rest.slice(trailingAt + 2));
  return { tags, command, params };
}

class TwitchChat {
  private sock: tls.TLSSocket | null = null;
  private buf = '';
  private joined = new Set<string>();
  /** channel → destination id (the first destination naming it). */
  private want = new Map<string, string>();
  private failures = 0;
  private lastLine = Date.now();
  private ready = false;

  setChannels(list: ChatChannel[]): void {
    this.want = new Map();
    for (const c of list) if (!this.want.has(c.channel)) this.want.set(c.channel, c.destinationId);
    if (this.want.size && !this.sock) this.connect();
    else this.sync();
  }

  /** Twitch PINGs about every 5 minutes; silence beyond 7 means the socket is dead. */
  checkAlive(): void {
    if (this.sock && Date.now() - this.lastLine > 7 * 60_000) {
      log('twitch: no traffic for 7 minutes; reconnecting');
      this.sock.destroy();
    }
  }

  private connect(): void {
    this.ready = false;
    this.joined.clear();
    const sock = tls.connect({ host: 'irc.chat.twitch.tv', port: 6697, servername: 'irc.chat.twitch.tv' });
    this.sock = sock;
    sock.setEncoding('utf8');
    sock.on('secureConnect', () => {
      this.lastLine = Date.now();
      sock.write('CAP REQ :twitch.tv/tags twitch.tv/commands\r\n');
      sock.write(`NICK justinfan${10000 + Math.floor(Math.random() * 80000)}\r\n`);
    });
    sock.on('data', (chunk: string) => {
      this.buf += chunk;
      let i;
      while ((i = this.buf.indexOf('\r\n')) >= 0) {
        const line = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 2);
        if (line) void this.onLine(line);
      }
    });
    sock.on('error', (err) => log('twitch: socket error:', err.message));
    sock.on('close', () => {
      if (this.sock !== sock) return;
      this.sock = null;
      this.buf = '';
      if (stopping || !this.want.size) return;
      this.failures++;
      const wait = Math.min(60, 2 ** Math.min(this.failures, 6)) * 1000;
      log(`twitch: disconnected; retry in ${wait / 1000}s`);
      setTimeout(() => { if (!this.sock && !stopping && this.want.size) this.connect(); }, wait);
    });
  }

  private sync(): void {
    if (!this.sock || !this.ready) return;
    const join = [...this.want.keys()].filter((c) => !this.joined.has(c));
    const part = [...this.joined].filter((c) => !this.want.has(c));
    // Anonymous joins are limited to 20 per 10 s; a handful of destinations is far below that.
    if (join.length) this.sock.write(`JOIN ${join.map((c) => `#${c}`).join(',')}\r\n`);
    if (part.length) this.sock.write(`PART ${part.map((c) => `#${c}`).join(',')}\r\n`);
    for (const c of part) this.joined.delete(c);
    if (!this.want.size) this.sock.end();
  }

  private async onLine(line: string): Promise<void> {
    this.lastLine = Date.now();
    const m = parseIrc(line);
    if (!m) return;
    const channel = (m.params[0] ?? '').replace(/^#/, '');
    try {
      switch (m.command) {
        case 'PING':
          this.sock?.write(`PONG :${m.params[0] ?? 'tmi.twitch.tv'}\r\n`);
          break;
        case '001':
          this.ready = true;
          this.failures = 0;
          log('twitch: connected');
          this.sync();
          break;
        case 'JOIN':
          if (!this.joined.has(channel)) log(`twitch: joined #${channel}`);
          this.joined.add(channel);
          break;
        case 'RECONNECT':
          log('twitch: server asked to reconnect');
          this.sock?.destroy();
          break;
        case 'NOTICE':
          log(`twitch: notice ${m.params.join(' ')}`);
          break;
        case 'PRIVMSG': {
          const id = m.tags['id'];
          if (!id) return;
          const ts = Number(m.tags['tmi-sent-ts']);
          await saveChat({
            destinationId: this.want.get(channel) ?? null,
            platform: 'twitch',
            channel,
            externalId: id,
            author: m.tags['display-name'] || m.tags['login'] || 'viewer',
            authorId: m.tags['user-id'] || null,
            body: m.params[1] ?? '',
            meta: {
              ...(m.tags['color'] ? { colour: m.tags['color'] } : {}),
              ...(m.tags['badges'] ? { badges: m.tags['badges'] } : {}),
              ...(m.tags['reply-parent-display-name'] ? { replyTo: m.tags['reply-parent-display-name'] } : {}),
            },
            sentAt: Number.isFinite(ts) ? new Date(ts) : new Date(),
          });
          break;
        }
        case 'CLEARMSG':
          if (m.tags['target-msg-id']) await removeChat('twitch', { externalId: m.tags['target-msg-id'] });
          break;
        case 'CLEARCHAT':
          // With a target user: that viewer was timed out or banned. Without one the whole chat was
          // cleared on Twitch; the Studio keeps its copy.
          if (m.tags['target-user-id']) await removeChat('twitch', { channel, authorId: m.tags['target-user-id'] });
          break;
      }
    } catch (err) {
      log(`twitch: ${m.command} failed:`, err instanceof Error ? err.message : err);
    }
  }

  close(): void {
    this.sock?.end();
  }
}

// ── YouTube ──────────────────────────────────────────────────────────────────

const YT_API = 'https://www.googleapis.com/youtube/v3';
const LOOK_MS = 60_000;
const QUOTA_PAUSE_MS = 3600_000;

interface YtFollow {
  destinationId: string;
  channelId: string;
  liveChatId: string | null;
  pageToken: string | null;
  nextAt: number;
  token: { value: string; until: number } | null;
  /** Last thing logged, so a waiting follow logs once, not every minute. */
  said: string;
}

class YouTubeError extends Error {
  constructor(readonly status: number, readonly reason: string, message: string) {
    super(message);
  }
}

class YouTubeChat {
  /** destination id → follow, for ticked YouTube destinations in the current go live. */
  private follows = new Map<string, YtFollow>();
  private busy = false;

  setChannels(list: ChatChannel[], live: Set<string>): void {
    const want = new Map(list.filter((c) => live.has(c.destinationId)).map((c) => [c.destinationId, c.channel]));
    for (const [id, f] of this.follows) {
      if (want.get(id) !== f.channelId) {
        this.follows.delete(id);
        log(`youtube: stopped following ${f.channelId}`);
      }
    }
    for (const [id, channelId] of want) {
      if (this.follows.has(id)) continue;
      this.follows.set(id, { destinationId: id, channelId, liveChatId: null, pageToken: null, nextAt: 0, token: null, said: '' });
      log(`youtube: following ${channelId}`);
    }
  }

  /** Called every second; each follow does at most one request when it is due. */
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const f of [...this.follows.values()]) {
        if (Date.now() < f.nextAt || !this.follows.has(f.destinationId)) continue;
        try {
          if (f.liveChatId) await this.read(f);
          else await this.look(f);
        } catch (err) {
          this.failed(f, err);
        }
      }
    } finally {
      this.busy = false;
    }
  }

  private say(f: YtFollow, text: string): void {
    if (f.said === text) return;
    f.said = text;
    log(`youtube ${f.channelId}: ${text}`);
  }

  private async token(f: YtFollow): Promise<string> {
    if (f.token && Date.now() < f.token.until) return f.token.value;
    const connectionId = await youtubeConnectionFor(f.channelId);
    if (!connectionId) throw new YouTubeError(0, 'noConnection', 'no connected YouTube account for this channel');
    // A system read: the destination's editor chose one of their own connected channels (relay-actions.ts).
    const t = await getConnectionAccessToken(connectionId);
    if (!t.ok) throw new YouTubeError(0, 'token', (t as { error: string }).error);
    // Google's access tokens last an hour; take a new one after 50 minutes.
    f.token = { value: t.accessToken, until: Date.now() + 50 * 60_000 };
    return f.token.value;
  }

  private async get(f: YtFollow, path: string, query: Record<string, string>): Promise<any> {
    const res = await fetch(`${YT_API}/${path}?${new URLSearchParams(query)}`, {
      headers: { authorization: `Bearer ${await this.token(f)}` },
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      const reason = data?.error?.errors?.[0]?.reason ?? String(res.status);
      throw new YouTubeError(res.status, reason, data?.error?.message ?? `HTTP ${res.status}`);
    }
    return data;
  }

  /** Find the channel's active broadcast and its chat (1 unit). */
  private async look(f: YtFollow): Promise<void> {
    f.nextAt = Date.now() + LOOK_MS;
    const data = await this.get(f, 'liveBroadcasts', {
      part: 'snippet',
      broadcastStatus: 'active',
      broadcastType: 'all',
      maxResults: '5',
    });
    const b = (data.items ?? []).find((i: any) => i?.snippet?.liveChatId);
    if (!b) return this.say(f, 'no active broadcast with chat yet; looking again each minute');
    f.liveChatId = b.snippet.liveChatId;
    f.pageToken = null;
    f.nextAt = 0;
    this.say(f, `reading chat of "${String(b.snippet.title ?? b.id).slice(0, 80)}"`);
  }

  /** One page of chat (5 units); YouTube says when to ask again. */
  private async read(f: YtFollow): Promise<void> {
    const data = await this.get(f, 'liveChat/messages', {
      liveChatId: f.liveChatId!,
      part: 'snippet,authorDetails',
      maxResults: '200',
      ...(f.pageToken ? { pageToken: f.pageToken } : {}),
    });
    f.pageToken = data.nextPageToken ?? f.pageToken;
    f.nextAt = Date.now() + Math.max(YT_MIN_MS, Number(data.pollingIntervalMillis) || 0);
    for (const item of data.items ?? []) await this.onItem(f, item);
    if (data.offlineAt) this.ended(f, 'the broadcast went offline');
  }

  private async onItem(f: YtFollow, item: any): Promise<void> {
    const sn = item?.snippet ?? {};
    const au = item?.authorDetails ?? {};
    switch (sn.type) {
      case 'messageDeletedEvent':
        if (sn.messageDeletedDetails?.deletedMessageId) await removeChat('youtube', { externalId: sn.messageDeletedDetails.deletedMessageId });
        return;
      case 'userBannedEvent':
        if (sn.userBannedDetails?.bannedUserDetails?.channelId) {
          await removeChat('youtube', { channel: f.channelId, authorId: sn.userBannedDetails.bannedUserDetails.channelId });
        }
        return;
      case 'chatEndedEvent':
        return this.ended(f, 'the chat ended');
      case 'tombstone':
        return;
    }
    const body = sn.displayMessage ?? sn.textMessageDetails?.messageText;
    if (!item.id || typeof body !== 'string' || !body) return;
    const roles = [au.isChatOwner && 'owner', au.isChatModerator && 'moderator', au.isChatSponsor && 'member', au.isVerified && 'verified'].filter(Boolean);
    await saveChat({
      destinationId: f.destinationId,
      platform: 'youtube',
      channel: f.channelId,
      externalId: item.id,
      author: au.displayName || 'viewer',
      authorId: au.channelId || null,
      body,
      meta: {
        ...(sn.type && sn.type !== 'textMessageEvent' ? { kind: sn.type } : {}),
        ...(roles.length ? { badges: roles.join(',') } : {}),
        ...(sn.superChatDetails?.amountDisplayString ? { amount: sn.superChatDetails.amountDisplayString } : {}),
      },
      sentAt: sn.publishedAt ? new Date(sn.publishedAt) : new Date(),
    });
  }

  private ended(f: YtFollow, why: string): void {
    this.say(f, `${why}; looking for a new broadcast`);
    f.liveChatId = null;
    f.pageToken = null;
    f.nextAt = Date.now() + LOOK_MS;
  }

  private failed(f: YtFollow, err: unknown): void {
    const e = err instanceof YouTubeError ? err : null;
    const reason = e?.reason ?? 'error';
    if (reason === 'quotaExceeded' || reason === 'rateLimitExceeded' || reason === 'dailyLimitExceeded') {
      f.nextAt = Date.now() + QUOTA_PAUSE_MS;
      return this.say(f, `YouTube quota used up (${reason}); pausing an hour`);
    }
    if (reason === 'liveStreamingNotEnabled') {
      f.nextAt = Date.now() + 10 * 60_000;
      return this.say(f, 'this channel is not enabled for live streaming on YouTube (youtube.com/features); checking every 10 minutes');
    }
    if (e?.status === 401) f.token = null;
    if (reason === 'liveChatEnded' || reason === 'liveChatNotFound' || reason === 'liveChatDisabled' || reason === 'forbidden') {
      return this.ended(f, `chat unavailable (${reason})`);
    }
    // No connection, a refused token, a missing scope, or the network: try again in a minute.
    f.nextAt = Date.now() + LOOK_MS;
    this.say(f, `${reason}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── loop ────────────────────────────────────────────────────────────────────

const twitch = new TwitchChat();
const youtube = new YouTubeChat();
let lastKey = '';
let lastPrune = 0;

async function scan(): Promise<void> {
  try {
    const list = await chatChannels();
    const key = list.map((c) => `${c.platform}:${c.channel}`).join(',');
    if (key !== lastKey) log(`channels: ${key || '(none)'}`);
    lastKey = key;
    twitch.setChannels(list.filter((c) => c.platform === 'twitch'));
    const yt = list.filter((c) => c.platform === 'youtube');
    youtube.setChannels(yt, yt.length ? await liveDestinationIds() : new Set());
    // Kick (phase 4) arrives by webhook, not here.
    twitch.checkAlive();
    if (Date.now() - lastPrune > 3600_000) {
      lastPrune = Date.now();
      const n = await pruneChat();
      if (n) log(`pruned ${n} messages older than 30 days`);
    }
  } catch (err) {
    log('scan failed:', err instanceof Error ? err.message : err);
  }
}

// Read only, unauthenticated: viewer chat is public on its platform, and only
// containers on eac-network (which already reach Postgres) can connect.
const http = createServer(async (req, res) => {
  const u = new URL(req.url ?? '/', 'http://stream-chat');
  if (req.method !== 'GET' || u.pathname !== '/recent') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return void res.end('not found');
  }
  try {
    const messages = await recentStreamChat(Number(u.searchParams.get('minutes')), Number(u.searchParams.get('limit')));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ messages }));
  } catch (err) {
    log('recent failed:', err instanceof Error ? err.message : err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{"messages":[]}');
  }
});
http.listen(PORT);

process.on('SIGTERM', () => { stopping = true; twitch.close(); http.close(); });
process.on('SIGINT', () => { stopping = true; twitch.close(); http.close(); });

log(`stream chat up; scanning every ${SCAN_MS / 1000}s; /recent on :${PORT}`);
await scan();
const ytTimer = setInterval(() => void youtube.tick(), 1000);
while (!stopping) {
  await new Promise((r) => setTimeout(r, SCAN_MS));
  if (!stopping) await scan();
}
clearInterval(ytTimer);
process.exit(0);
