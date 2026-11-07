// Relay agent: runs beside MediaMTX in the relay container (docker/relay/start.sh)
// and listens on eac-network for arts-collective's server actions.
//
//   GET  /status                 program, outputs, feeds, recent events
//   POST /outputs  {outputs: [{id, label, url}]}   arm these (replaces the set)
//   POST /outputs/stop           disarm all; returns what each output did
//   GET  /feeds
//   POST /feeds         {label}  new feed key (publish to rtmp://relay:1935/in/<key>)
//   POST /feeds/delete  {key}    remove; a connected publisher is dropped
//
//   POST /auth   MediaMTX's HTTP auth callback (127.0.0.1 only, no bearer)
//
// Every other request needs `Authorization: Bearer $RELAY_AGENT_SECRET`.
//
// Fan-out: while outputs are armed and the `program` path has a publisher,
// one `ffmpeg -c copy` per output reads rtmp://127.0.0.1:1935/program and
// pushes it to the destination. Each output retries on its own with backoff;
// stream keys stay in this process's memory only (arts-collective unseals
// them from stream_destinations at Go live) and are never returned.
//
// Who may do what (answered in /auth):
//   publish program     user "obs" + RELAY_OBS_PASS, from a private address (the server OBS)
//   publish in/<key>    any client that knows a feed key in /data/feeds.json
//                       (over WebRTC/WHIP this is the only thing allowed)
//   read anything       this container (the ffmpeg outputs), or "obs" + RELAY_OBS_PASS
//                       from a private address (OBS media sources for feeds)
// With 1935 open to the internet (RELAY_RTMP_BIND), a public address refused
// STRIKES times within STRIKE_WINDOW_MS is refused everything for BLOCK_MS.
// Private addresses are never blocked: if Docker shows outside clients as the
// bridge gateway, blocking that one address would shut out every feed.

import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const SECRET = process.env.RELAY_AGENT_SECRET ?? '';
const OBS_PASS = process.env.RELAY_OBS_PASS ?? '';
const PORT = Number(process.env.RELAY_AGENT_PORT) || 4457;
const MTX_API = 'http://127.0.0.1:9997';
const PROGRAM_IN = 'rtmp://127.0.0.1:1935/program';
const FEEDS_FILE = '/data/feeds.json';
const log = (...a) => console.log('[relay-agent]', ...a);

if (!SECRET || !OBS_PASS) {
  console.error('[relay-agent] RELAY_AGENT_SECRET and RELAY_OBS_PASS are required');
  process.exit(1);
}

const same = (a, b) => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && timingSafeEqual(x, y);
};
const isLoopback = (ip) => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
/** Loopback, RFC 1918, link-local, IPv6 ULA. */
function isPrivate(raw) {
  const ip = String(raw ?? '').replace(/^::ffff:/, '');
  if (ip === '::1' || /^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip)) return true;
  const o = ip.split('.').map(Number);
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return o[0] === 10 || o[0] === 127 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 192 && o[1] === 168) || (o[0] === 169 && o[1] === 254);
}

// ---------------------------------------------------------------------------
// Events: the last 200, in memory. arts-collective records the start/stop
// summary in stream_events; this ring is the live detail (retries, errors).
// ---------------------------------------------------------------------------

const events = [];
function event(name, detail = {}) {
  events.push({ at: new Date().toISOString(), event: name, ...detail });
  if (events.length > 200) events.shift();
  log(name, JSON.stringify(detail));
}

// ---------------------------------------------------------------------------
// Feeds in: { key, label, createdAt }[], persisted in the data volume.
// ---------------------------------------------------------------------------

let feeds = [];
async function loadFeeds() {
  try {
    const raw = JSON.parse(await readFile(FEEDS_FILE, 'utf8'));
    feeds = Array.isArray(raw) ? raw.filter((f) => f && typeof f.key === 'string') : [];
  } catch {
    feeds = [];
  }
}
async function saveFeeds() {
  const tmp = `${FEEDS_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(feeds, null, 2));
  await rename(tmp, FEEDS_FILE);
}

// ---------------------------------------------------------------------------
// MediaMTX's view of paths
// ---------------------------------------------------------------------------

/** @returns {Promise<Map<string, any>>} path name -> MediaMTX path item */
async function paths() {
  const r = await fetch(`${MTX_API}/v3/paths/list?itemsPerPage=1000`, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error(`MediaMTX API ${r.status}`);
  const data = await r.json();
  return new Map((data.items ?? []).map((p) => [p.name, p]));
}

const trackNames = (p) =>
  (p?.tracks2 ?? p?.tracks ?? []).map((t) => (typeof t === 'string' ? t : t?.codec ?? '?'));

function pathView(p) {
  if (!p || !p.ready) return { ready: false };
  return {
    ready: true,
    since: p.readyTime ?? null,
    tracks: trackNames(p),
    bytesReceived: p.bytesReceived ?? 0,
    readers: (p.readers ?? []).length,
    source: p.source?.type ?? null,
  };
}

async function kick(p) {
  const src = p?.source;
  if (!src?.id || !src?.type) return;
  // rtmpConn -> rtmpconns, rtmpsConn -> rtmpsconns, ...
  const kind = `${String(src.type).replace(/Conn$/, '').toLowerCase()}conns`;
  await fetch(`${MTX_API}/v3/${kind}/kick/${src.id}`, { method: 'POST', signal: AbortSignal.timeout(3000) }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Outputs (fan-out)
// ---------------------------------------------------------------------------

/**
 * @typedef {{ id: string, label: string, url: string, host: string,
 *   state: 'waiting'|'connecting'|'live'|'retrying'|'stopped',
 *   since: number, retries: number, lastError: string|null, bytes: number,
 *   liveMs: number, liveAt: number|null, proc: any, timer: any, armedAt: number }} Output
 */
/** @type {Map<string, Output>} */
const outputs = new Map();
let programReady = false;

function hostOf(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '?';
  }
}

function checkUrl(url) {
  if (typeof url !== 'string' || url.length > 2000 || !/^rtmps?:\/\//i.test(url)) throw new Error('Destination must be an rtmp:// or rtmps:// address');
  const h = new URL(url).hostname.toLowerCase();
  // Pushing the program back into this relay would loop.
  if (h === 'localhost' || h === 'relay' || h === 'eac-relay' || h.startsWith('127.') || h === '[::1]') throw new Error('That address is this relay');
}

function setState(o, state) {
  if (o.state === state) return;
  if (o.state === 'live' && o.liveAt) o.liveMs += Date.now() - o.liveAt;
  o.state = state;
  o.since = Date.now();
  o.liveAt = state === 'live' ? Date.now() : null;
}

function startOutput(o) {
  if (o.proc || o.timer) return;
  setState(o, 'connecting');
  const args = [
    '-hide_banner', '-loglevel', 'error', '-nostats', '-progress', 'pipe:1',
    '-rw_timeout', '15000000',
    '-i', PROGRAM_IN,
    '-map', '0', '-c', 'copy',
    '-f', 'flv', '-flvflags', 'no_duration_filesize',
    o.url,
  ];
  const p = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  o.proc = p;
  const startedAt = Date.now();
  let err = '';
  let buf = '';
  let base = o.bytes;
  p.stdout.on('data', (c) => {
    buf += c;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith('total_size=')) {
        const n = Number(line.slice(11));
        if (Number.isFinite(n) && n > 0) {
          o.bytes = base + n;
          if (o.state !== 'live') {
            setState(o, 'live');
            event('output_live', { id: o.id, label: o.label, host: o.host });
          }
        }
      }
    }
  });
  p.stderr.on('data', (c) => (err = (err + c).slice(-1500)));
  p.on('error', (e) => (err = e.message));
  p.on('close', async (code) => {
    o.proc = null;
    if (!outputs.has(o.id)) return; // disarmed; stopOutputs logged it
    // The program ending also ends every output; look again before calling it a failure.
    await watch();
    if (!outputs.has(o.id) || o.proc || o.timer) return;
    // ffmpeg's last line is generic ("I/O error"); the cause is a line or two above.
    const lines = err.split('\n').map((l) => l.replace(/^\[[^\]]*\]\s*/, '').trim()).filter(Boolean);
    const message = (lines.slice(-3).join(' · ') || `ffmpeg exit ${code}`).split(o.url).join(o.host).slice(0, 400);
    if (!programReady) {
      setState(o, 'waiting');
      return;
    }
    o.lastError = message;
    // Backoff 2, 4, 8 … 30 s; a run of a minute or more starts it over.
    if (Date.now() - startedAt > 60_000) o.retries = 0;
    o.retries += 1;
    const wait = Math.min(30, 2 ** Math.min(o.retries, 5)) * 1000;
    setState(o, 'retrying');
    event('output_failed', { id: o.id, label: o.label, host: o.host, error: message, retryInS: wait / 1000 });
    o.timer = setTimeout(() => {
      o.timer = null;
      if (outputs.has(o.id) && programReady) startOutput(o);
    }, wait);
  });
}

function stopOutput(o) {
  if (o.timer) clearTimeout(o.timer);
  o.timer = null;
  if (o.proc) {
    const p = o.proc;
    p.kill('SIGTERM');
    setTimeout(() => p.exitCode === null && p.kill('SIGKILL'), 3000);
  }
  setState(o, 'stopped');
}

function outputView(o) {
  return {
    id: o.id,
    label: o.label,
    host: o.host,
    state: o.state,
    since: new Date(o.since).toISOString(),
    retries: o.retries,
    lastError: o.lastError,
    bytes: o.bytes,
    liveSeconds: Math.round((o.liveMs + (o.liveAt ? Date.now() - o.liveAt : 0)) / 1000),
  };
}

function armOutputs(list) {
  if (!Array.isArray(list) || list.length > 12) throw new Error('outputs: an array of at most 12');
  const next = new Map();
  for (const d of list) {
    const id = String(d?.id ?? '').slice(0, 64);
    if (!id) throw new Error('Each output needs an id');
    checkUrl(d.url);
    next.set(id, { id, label: String(d.label ?? id).slice(0, 80), url: d.url });
  }
  // Drop outputs no longer wanted; keep running ones whose address is unchanged.
  for (const [id, o] of outputs) {
    const want = next.get(id);
    if (!want || want.url !== o.url) {
      stopOutput(o);
      outputs.delete(id);
      event('output_disarmed', { id, label: o.label });
    }
  }
  for (const [id, d] of next) {
    if (outputs.has(id)) {
      outputs.get(id).label = d.label;
      continue;
    }
    const now = Date.now();
    const o = { ...d, host: hostOf(d.url), state: 'waiting', since: now, retries: 0, lastError: null, bytes: 0, liveMs: 0, liveAt: null, proc: null, timer: null, armedAt: now };
    outputs.set(id, o);
    event('output_armed', { id, label: o.label, host: o.host });
    if (programReady) startOutput(o);
  }
  return [...outputs.values()].map(outputView);
}

function stopOutputs() {
  const summary = [];
  for (const [id, o] of outputs) {
    stopOutput(o);
    summary.push(outputView(o));
    outputs.delete(id);
    event('output_stopped', { id, label: o.label, liveSeconds: summary.at(-1).liveSeconds });
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Watch: program up/down starts and parks outputs; feeds on/offline.
// ---------------------------------------------------------------------------

const feedOnline = new Set();
let lastPaths = new Map();
async function watch() {
  try {
    lastPaths = await paths();
  } catch {
    return;
  }
  const ready = Boolean(lastPaths.get('program')?.ready);
  if (ready !== programReady) {
    programReady = ready;
    event(ready ? 'program_ready' : 'program_ended', ready ? { tracks: trackNames(lastPaths.get('program')) } : {});
    if (ready) for (const o of outputs.values()) startOutput(o);
    else for (const o of outputs.values()) if (o.timer) { clearTimeout(o.timer); o.timer = null; setState(o, 'waiting'); }
  }
  for (const f of feeds) {
    const on = Boolean(lastPaths.get(`in/${f.key}`)?.ready);
    if (on !== feedOnline.has(f.key)) {
      if (on) feedOnline.add(f.key);
      else feedOnline.delete(f.key);
      event(on ? 'feed_online' : 'feed_offline', { label: f.label });
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const STRIKES = 10;
const STRIKE_WINDOW_MS = 10 * 60_000;
const BLOCK_MS = 10 * 60_000;
/** @type {Map<string, {n: number, first: number, until: number, logged: number}>} */
const strikes = new Map();
const isBlocked = (ip) => (strikes.get(ip)?.until ?? 0) > Date.now();

/** Count a refusal from a public address; block it at STRIKES. Logs at most once a minute per address. */
function strike(ip, a) {
  const now = Date.now();
  let s = strikes.get(ip);
  if (!s || now - s.first > STRIKE_WINDOW_MS) s = { n: 0, first: now, until: 0, logged: 0 };
  s.n += 1;
  if (!isPrivate(ip) && s.n >= STRIKES && s.until <= now) {
    s.until = now + BLOCK_MS;
    event('ip_blocked', { ip, refusals: s.n, minutes: BLOCK_MS / 60_000 });
  } else if (now - s.logged > 60_000) {
    s.logged = now;
    log(`refused ${a.action} ${a.path} from ${ip} (${a.protocol}; ${s.n} in this window)`);
  }
  strikes.set(ip, s);
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, s] of strikes) if (s.until <= now && now - s.first > STRIKE_WINDOW_MS) strikes.delete(ip);
}, 60_000).unref();

function authorize(a) {
  const path = String(a.path ?? '');
  if (isBlocked(String(a.ip ?? ''))) return false;
  // WebRTC (WHIP guests) arrives through NPM from a private address, so the
  // private-address rule below proves nothing there: allow only publishing to
  // an existing feed, never `program`, never a read (WHEP).
  if (String(a.protocol ?? '') === 'webrtc') {
    const m = a.action === 'publish' ? /^in\/(.+)$/.exec(path) : null;
    return Boolean(m && feeds.some((f) => same(f.key, m[1])));
  }
  // OBS's own credentials count only from inside: the server network, or a LAN.
  const obs = isPrivate(a.ip) && a.user === 'obs' && same(a.password, OBS_PASS);
  if (a.action === 'publish') {
    if (path === 'program') return obs;
    const m = /^in\/(.+)$/.exec(path);
    return Boolean(m && feeds.some((f) => same(f.key, m[1])));
  }
  if (a.action === 'read') return isLoopback(a.ip) || obs;
  return false;
}

async function body(req) {
  let s = '';
  for await (const c of req) {
    s += c;
    if (s.length > 50_000) throw new Error('Body too large');
  }
  return s ? JSON.parse(s) : {};
}

const routes = {
  'GET /status': async () => ({
    program: pathView(lastPaths.get('program')),
    outputs: [...outputs.values()].map(outputView),
    feeds: feeds.map((f) => ({ key: f.key, label: f.label, createdAt: f.createdAt, ...pathView(lastPaths.get(`in/${f.key}`)) })),
    events: events.slice(-40).reverse(),
  }),
  'POST /outputs': (b) => ({ outputs: armOutputs(b.outputs) }),
  'POST /outputs/stop': () => ({ outputs: stopOutputs() }),
  'GET /feeds': () => feeds,
  'POST /feeds': async (b) => {
    const label = String(b.label ?? '').trim().slice(0, 60);
    if (!label) throw new Error('Name the feed');
    if (feeds.length >= 50) throw new Error('At most 50 feeds');
    const f = { key: randomBytes(15).toString('base64url'), label, createdAt: new Date().toISOString() };
    feeds.push(f);
    await saveFeeds();
    event('feed_added', { label });
    return f;
  },
  'POST /feeds/delete': async (b) => {
    const f = feeds.find((x) => x.key === String(b.key ?? ''));
    if (!f) return {};
    feeds = feeds.filter((x) => x !== f);
    await saveFeeds();
    await kick(lastPaths.get(`in/${f.key}`));
    feedOnline.delete(f.key);
    event('feed_removed', { label: f.label });
    return {};
  },
};

createServer(async (req, res) => {
  const send = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  const path = (req.url ?? '/').split('?')[0];
  try {
    if (req.method === 'POST' && path === '/auth') {
      if (!isLoopback(req.socket.remoteAddress)) return send(403, {});
      const a = await body(req);
      const ok = authorize(a);
      if (!ok && !isBlocked(String(a.ip ?? ''))) strike(String(a.ip ?? ''), a);
      return send(ok ? 200 : 401, {});
    }
    if (!same(req.headers.authorization, `Bearer ${SECRET}`)) return send(401, { error: 'unauthorized' });
    const handler = routes[`${req.method} ${path}`];
    if (!handler) return send(404, { error: 'not found' });
    send(200, (await handler(req.method === 'POST' ? await body(req) : {})) ?? {});
  } catch (err) {
    send(400, { error: err.message });
  }
}).listen(PORT, '0.0.0.0', () => log(`listening on ${PORT}`));

await loadFeeds();
setInterval(watch, 2000);
watch();
