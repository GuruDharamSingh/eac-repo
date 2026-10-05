// OBS agent: the only thing that talks to OBS. Runs inside the obs container
// (docker/obs/start.sh) and listens on eac-network for arts-collective's
// server actions; the websocket password never leaves this container.
//
//   GET  /status                 connection, scenes, outputs, stats
//   GET  /screenshot             JPEG of the program output
//   POST /scene      {name}
//   POST /browser    {url}       the "Browser" scene's page
//   POST /record     {action: start|stop}
//   POST /stream     {action: start|stop}
//   POST /stream/settings {server, key}
//   GET  /recordings
//   POST /recordings/upload {file, path}   remux to MP4, PUT to Nextcloud
//   POST /recordings/delete {file}
//
//   POST /lock       {holder, name}   claim or renew the one session
//   POST /unlock     {holder}
//
// Every request needs `Authorization: Bearer $OBS_AGENT_SECRET`. One session
// at a time: every POST except /lock and /unlock also needs `X-Holder` equal
// to the current lock's holder. A lock not renewed for LOCK_TTL_MS lapses
// (a closed tab frees the studio on its own).
// obs-websocket protocol 5 is implemented here directly over Node's global
// WebSocket: four message types, no dependency.

import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { basename, join } from 'node:path';

const PASSWORD = process.env.OBS_WEBSOCKET_PASSWORD ?? '';
const SECRET = process.env.OBS_AGENT_SECRET ?? '';
const PORT = Number(process.env.OBS_AGENT_PORT) || 4456;
const REC_DIR = '/recordings';
// Scenes and inputs share one namespace in OBS: the input cannot also be "Browser".
const BROWSER_INPUT = 'Browser page';
const W = Number(process.env.OBS_WIDTH) || 1920;
const H = Number(process.env.OBS_HEIGHT) || 1080;
const NC_URL = process.env.NEXTCLOUD_URL ?? '';
const NC_USER = process.env.NEXTCLOUD_ADMIN_USER ?? '';
const NC_AUTH = `Basic ${Buffer.from(`${NC_USER}:${process.env.NEXTCLOUD_ADMIN_PASSWORD ?? ''}`).toString('base64')}`;

const log = (...a) => console.log('[obs-agent]', ...a);
const LOCK_TTL_MS = 20_000;
/** @type {{holder: string, name: string, since: number, seen: number} | null} */
let lock = null;
const lockLive = () => lock && Date.now() - lock.seen < LOCK_TTL_MS;
const lockView = () => (lockLive() ? { name: lock.name, since: new Date(lock.since).toISOString() } : null);
if (!SECRET || !PASSWORD) {
  console.error('[obs-agent] OBS_AGENT_SECRET and OBS_WEBSOCKET_PASSWORD are required');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// obs-websocket 5
// ---------------------------------------------------------------------------

let ws = null;
let identified = false;
let nextId = 1;
const pending = new Map();
const sha256b64 = (s) => createHash('sha256').update(s).digest('base64');

let attempts = 0;
let startedOnce = false;
function connect() {
  identified = false;
  if (++attempts % 20 === 0) log(`still waiting for OBS (attempt ${attempts})`);
  const sock = new WebSocket('ws://127.0.0.1:4455');
  ws = sock;
  sock.onmessage = async (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.op === 0) {
      const ident = { rpcVersion: 1, eventSubscriptions: 0 };
      const auth = msg.d.authentication;
      if (auth) ident.authentication = sha256b64(sha256b64(PASSWORD + auth.salt) + auth.challenge);
      sock.send(JSON.stringify({ op: 1, d: ident }));
    } else if (msg.op === 2) {
      identified = true;
      attempts = 0;
      log('connected to OBS', msg.d.negotiatedRpcVersion);
      ensureScenes().catch((e) => log('scene setup failed:', e.message));
    } else if (msg.op === 7) {
      const p = pending.get(msg.d.requestId);
      if (!p) return;
      pending.delete(msg.d.requestId);
      clearTimeout(p.timer);
      if (msg.d.requestStatus.result) p.ok(msg.d.responseData ?? {});
      else p.fail(new Error(`${msg.d.requestType}: ${msg.d.requestStatus.comment ?? msg.d.requestStatus.code}`));
    }
  };
  // Node 22's WebSocket fires only `error` (no `close`) when the connection is
  // refused, which is every attempt made before OBS is listening: retry on
  // whichever comes first, once.
  let retried = false;
  const retry = () => {
    if (retried) return;
    retried = true;
    identified = false;
    for (const p of pending.values()) p.fail(new Error('OBS disconnected'));
    pending.clear();
    try { sock.close(); } catch { /* already closed */ }
    setTimeout(connect, 3000);
  };
  sock.onclose = (ev) => {
    if (identified || ev.code !== 1006) log(`OBS connection closed (${ev.code}${ev.reason ? `: ${ev.reason}` : ''})`);
    retry();
  };
  sock.onerror = retry;
}

function call(requestType, requestData = {}, timeoutMs = 10000) {
  if (!identified) return Promise.reject(new Error('OBS is not running yet'));
  const requestId = String(nextId++);
  return new Promise((ok, fail) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      fail(new Error(`${requestType}: timed out`));
    }, timeoutMs);
    pending.set(requestId, { ok, fail, timer });
    ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
  });
}

/** The starting scenes, created once; people rearrange them in the OBS window after. */
async function ensureScenes() {
  const { scenes } = await call('GetSceneList');
  const have = new Set(scenes.map((s) => s.sceneName));
  const inputs = new Set((await call('GetInputList')).inputs.map((i) => i.inputName));
  const add = async (scene, inputName, inputKind, inputSettings) => {
    if (!have.has(scene)) {
      await call('CreateScene', { sceneName: scene });
      have.add(scene);
    }
    if (!inputs.has(inputName)) {
      await call('CreateInput', { sceneName: scene, inputName, inputKind, inputSettings, sceneItemEnabled: true });
      inputs.add(inputName);
    }
  };
  await add('Holding', 'Holding background', 'color_source_v3', { color: 0xff141110, width: W, height: H });
  await add('Holding', 'Holding text', 'text_ft2_source_v2', {
    text: 'Elkdonis Arts Collective',
    font: { face: 'DejaVu Serif', size: 96, style: 'Regular', flags: 0 },
    color1: 0xffeaf1f4,
    color2: 0xffeaf1f4,
  });
  await add('Browser', BROWSER_INPUT, 'browser_source', {
    url: 'about:blank', width: W, height: H, fps: 30, reroute_audio: true, shutdown: true,
  });
  await add('Media', 'Media file', 'ffmpeg_source', { is_local_file: true, local_file: '', looping: false });

  // Layout, reapplied on every connect: page and media fill the frame, the
  // holding text is centred. (Alignment: 0 = centre, 5 = top-left.)
  const place = async (sceneName, sourceName, transform) => {
    const { sceneItemId } = await call('GetSceneItemId', { sceneName, sourceName });
    await call('SetSceneItemTransform', { sceneName, sceneItemId, sceneItemTransform: transform });
  };
  // Off air, the page is shut down (it reloads when its scene is shown):
  // left running it costs about a core while nobody watches.
  await call('SetInputSettings', { inputName: BROWSER_INPUT, inputSettings: { shutdown: true, width: W, height: H } });
  const fill = { positionX: 0, positionY: 0, alignment: 5, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsAlignment: 0, boundsWidth: W, boundsHeight: H };
  await place('Browser', BROWSER_INPUT, fill);
  await place('Media', 'Media file', fill);
  await place('Holding', 'Holding background', { positionX: 0, positionY: 0, alignment: 5 });
  await place('Holding', 'Holding text', { positionX: W / 2, positionY: H / 2, alignment: 0 });

  // Start on the cheap scene: an idle browser page costs about 1.6 cores.
  if (!startedOnce) {
    startedOnce = true;
    const rec = await call('GetRecordStatus');
    const str = await call('GetStreamStatus');
    if (!rec.outputActive && !str.outputActive) await call('SetCurrentProgramScene', { sceneName: 'Holding' });
  }

  // OBS's own empty "Scene" from first run.
  if (have.has('Scene') && have.size > 1) {
    const { sceneItems } = await call('GetSceneItemList', { sceneName: 'Scene' });
    if (sceneItems.length === 0) {
      const cur = (await call('GetCurrentProgramScene')).currentProgramSceneName;
      if (cur === 'Scene') await call('SetCurrentProgramScene', { sceneName: 'Holding' });
      await call('RemoveScene', { sceneName: 'Scene' });
    }
  }
  // The browser source's first load races the container's network at start
  // and stays black; refresh it once things have settled.
  setTimeout(() => {
    call('PressInputPropertiesButton', { inputName: BROWSER_INPUT, propertyName: 'refreshnocache' }).catch(() => {});
  }, 8000);
  log('scenes ready');
}

// ---------------------------------------------------------------------------
// Recordings
// ---------------------------------------------------------------------------

function run(cmd, args) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (c) => (err = (err + c).slice(-2000)));
    p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok() : fail(new Error(err.trim() || `exit ${code}`))));
  });
}

const safeFile = (f) => typeof f === 'string' && /^[\w .,()+-]+\.(mkv|mp4|mov|flv)$/i.test(f) && !f.includes('..');

async function listRecordings() {
  const names = await readdir(REC_DIR).catch(() => []);
  const out = [];
  for (const name of names) {
    if (!safeFile(name)) continue;
    const s = await stat(join(REC_DIR, name));
    out.push({ name, size: s.size, modified: s.mtime.toISOString() });
  }
  return out.sort((a, b) => b.modified.localeCompare(a.modified));
}

async function davMkcols(path) {
  const parts = path.split('/').filter(Boolean);
  for (let i = 1; i <= parts.length; i++) {
    const url = `${NC_URL}/remote.php/dav/files/${encodeURIComponent(NC_USER)}/${parts.slice(0, i).map(encodeURIComponent).join('/')}`;
    const r = await fetch(url, { method: 'MKCOL', headers: { Authorization: NC_AUTH } });
    if (!r.ok && r.status !== 405) throw new Error(`MKCOL ${r.status}`);
  }
}

/** Remux to MP4 (no re-encode) and stream it to Nextcloud at `path`. */
async function upload(file, path) {
  if (!safeFile(file)) throw new Error('Bad file name');
  // Only into someone's or some org's Private tree: the caller decides whose.
  if (!/^EAC_Network\/.+\/Private\/.+\.mp4$/.test(path) || path.includes('..')) throw new Error('Bad target path');
  const src = join(REC_DIR, file);
  let mp4 = src;
  if (!/\.mp4$/i.test(file)) {
    mp4 = join(REC_DIR, `.upload-${Date.now()}.mp4`);
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-c', 'copy', '-movflags', '+faststart', mp4]);
  }
  try {
    await davMkcols(path.split('/').slice(0, -1).join('/'));
    const size = (await stat(mp4)).size;
    const url = `${NC_URL}/remote.php/dav/files/${encodeURIComponent(NC_USER)}/${path.split('/').map(encodeURIComponent).join('/')}`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: NC_AUTH, 'Content-Type': 'video/mp4', 'Content-Length': String(size) },
      body: createReadStream(mp4),
      duplex: 'half',
    });
    if (!r.ok) throw new Error(`Storage refused the file (${r.status})`);
    return { path, size };
  } finally {
    if (mp4 !== src) await rm(mp4, { force: true });
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function status() {
  if (!identified) return { connected: false, lock: lockView() };
  const [scenes, rec, stream, stats, browser] = await Promise.all([
    call('GetSceneList'),
    call('GetRecordStatus'),
    call('GetStreamStatus'),
    call('GetStats'),
    call('GetInputSettings', { inputName: BROWSER_INPUT }).catch(() => null),
  ]);
  return {
    connected: true,
    scenes: scenes.scenes.map((s) => s.sceneName).reverse(),
    currentScene: scenes.currentProgramSceneName,
    recording: { active: rec.outputActive, paused: rec.outputPaused, timecode: rec.outputTimecode, bytes: rec.outputBytes },
    streaming: { active: stream.outputActive, timecode: stream.outputTimecode, skipped: stream.outputSkippedFrames },
    stats: {
      cpu: stats.cpuUsage,
      memoryMb: stats.memoryUsage,
      fps: stats.activeFps,
      renderMs: stats.averageFrameRenderTime,
      renderSkipped: stats.renderSkippedFrames,
      outputSkipped: stats.outputSkippedFrames,
      outputTotal: stats.outputTotalFrames,
    },
    browserUrl: browser?.inputSettings?.url ?? null,
    lock: lockView(),
  };
}

function authorized(req) {
  const got = Buffer.from(String(req.headers.authorization ?? ''));
  const want = Buffer.from(`Bearer ${SECRET}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function body(req) {
  let s = '';
  for await (const c of req) {
    s += c;
    if (s.length > 10_000) throw new Error('Body too large');
  }
  return s ? JSON.parse(s) : {};
}

const routes = {
  'POST /lock': (b) => {
    const holder = String(b.holder ?? '');
    if (!holder) throw new Error('holder required');
    if (lockLive() && lock.holder !== holder) return { held: false, lock: lockView() };
    const now = Date.now();
    if (!lockLive() || lock.holder !== holder) {
      lock = { holder, name: String(b.name ?? 'someone').slice(0, 80), since: now, seen: now };
      log(`session opened by ${lock.name}`);
    } else lock.seen = now;
    return { held: true, lock: lockView() };
  },
  'POST /unlock': (b) => {
    if (lock && lock.holder === String(b.holder ?? '')) {
      log(`session closed by ${lock.name}`);
      lock = null;
    }
    return {};
  },
  'GET /status': () => status(),
  'GET /recordings': () => listRecordings(),
  'POST /scene': (b) => call('SetCurrentProgramScene', { sceneName: String(b.name) }),
  'POST /browser': (b) => {
    const url = String(b.url ?? '');
    if (!/^https?:\/\//.test(url) && url !== 'about:blank') throw new Error('Use an http(s) address');
    return call('SetInputSettings', { inputName: BROWSER_INPUT, inputSettings: { url } });
  },
  'POST /record': (b) => call(b.action === 'stop' ? 'StopRecord' : 'StartRecord'),
  'POST /stream': (b) => call(b.action === 'stop' ? 'StopStream' : 'StartStream'),
  'POST /stream/settings': (b) =>
    call('SetStreamServiceSettings', {
      streamServiceType: 'rtmp_custom',
      streamServiceSettings: { server: String(b.server ?? ''), key: String(b.key ?? ''), use_auth: false },
    }),
  'POST /recordings/upload': (b) => upload(b.file, b.path),
  'POST /recordings/delete': async (b) => {
    if (!safeFile(b.file)) throw new Error('Bad file name');
    await rm(join(REC_DIR, basename(b.file)), { force: true });
    return {};
  },
};

createServer(async (req, res) => {
  const send = (code, data, type = 'application/json') => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(type === 'application/json' ? JSON.stringify(data) : data);
  };
  if (!authorized(req)) return send(401, { error: 'unauthorized' });
  const path = (req.url ?? '/').split('?')[0];
  try {
    if (req.method === 'GET' && path === '/screenshot') {
      // The picture is part of the session: only its holder sees it.
      if (!lockLive() || lock.holder !== String(req.headers['x-holder'] ?? '')) return send(423, { error: 'not the session holder' });
      const scene = (await call('GetCurrentProgramScene')).currentProgramSceneName;
      const shot = await call('GetSourceScreenshot', { sourceName: scene, imageFormat: 'jpg', imageWidth: 960, imageCompressionQuality: 70 });
      return send(200, Buffer.from(shot.imageData.split(',')[1], 'base64'), 'image/jpeg');
    }
    const handler = routes[`${req.method} ${path}`];
    if (!handler) return send(404, { error: 'not found' });
    if (req.method === 'POST' && path !== '/lock' && path !== '/unlock') {
      if (!lockLive() || lock.holder !== String(req.headers['x-holder'] ?? '')) {
        return send(423, { error: lockLive() ? `The studio is in use by ${lock.name}` : 'Open the studio first' });
      }
      lock.seen = Date.now();
    }
    const data = await handler(req.method === 'POST' ? await body(req) : {});
    send(200, data ?? {});
  } catch (err) {
    send(500, { error: err.message });
  }
}).listen(PORT, '0.0.0.0', () => log(`listening on ${PORT}`));

connect();
