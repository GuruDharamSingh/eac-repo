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
//   POST /stream/relay               stream to the relay's program path (docker/relay)
//   POST /feeds/add  {key, label}    a relay feed as its own scene
//   GET  /recordings
//   POST /recordings/upload {file, path}   remux to MP4, PUT to Nextcloud
//   POST /recordings/delete {file}
//   POST /recordings/copy {file, path, by}   the same as upload, in the background;
//                                     progress in GET /recordings (`copy`). No lease needed.
//   POST /recordings/remove {file}   delete without the lease; refused for the file being recorded
//
//   POST /lock       {holder, name}   claim or renew the one session
//   POST /unlock     {holder}
//   POST /door/token {purpose}        one-time token for the door (below)
//   GET  /studio, POST /studio {op, …}   scenes, sources, layouts, transitions, audio (studioCommand);
//                                     op transition.stinger points a Stinger made in the desktop at a video (setStinger)
//   POST /studio/source {name}       one source's editable settings
//   GET  /graphics                   OGraf catalog and layers
//   POST /graphics {op, …}           add/remove/play/stop/update/step/custom/move/clear
//   POST /graphics/upload {folder, files: [{path, data(base64)}]}, /graphics/delete {folder}
//   POST /overlay/reload             reload the page after editing it
//
// Every request needs `Authorization: Bearer $OBS_AGENT_SECRET`. One session
// at a time: every POST except /lock and /unlock also needs `X-Holder` equal
// to the current lock's holder. A lock not renewed for LOCK_TTL_MS lapses
// (a closed tab frees the studio on its own).
// obs-websocket protocol 5 is implemented here directly over Node's global
// WebSocket: four message types, no dependency.
//
// The door (DOOR_PORT, published on the host; the edge sends
// https://arts-collective.com/obs/ here) is how the booth page
// (/studio/broadcast/desktop) reaches the full OBS window, its sound and its
// picture from a browser anywhere:
//
//   GET /obs/desktop/…               noVNC's client files (public, no token)
//   GET /obs/desktop/ws?token=       websocket → websockify → wayvnc
//   GET /obs/audio?token=            raw PCM, s16le 48 kHz stereo, of the
//                                    "booth" sink (OBS's monitoring device)
//   GET /obs/program?token=&fps=&w=  MJPEG of the program scene
//   GET /obs/levels?token=           mixer meters (server-sent events, 10 a second)
//   WS  /obs/camera/ws?token=&name=&scene=&layout=   a browser camera into OBS (Cameras)
//   GET /obs/overlay/…               the renderer page, graphics files, state, events,
//                                    and chat (the stream-chat collector's /recent, for
//                                    graphic eac-chat) (loopback only: OBS's own browser source)
//
// Each connection needs its own token from POST /door/token: 60 s, one use,
// bound to the lease holder who asked. A connection lives only while its
// holder has the lease, and an open connection renews the lease (the tab
// that holds it is open).

import { createServer } from 'node:http';
import { connect as connectTcp } from 'node:net';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream, createWriteStream, readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { basename, extname, join, posix } from 'node:path';

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

// Graphics (EBU OGraf v1, https://ograf.ebu.io): docker/obs/overlay/index.html
// is a renderer that hosts OGraf graphics in layers on OBS's "Overlays"
// source. A graphic is a folder with a *.ograf.json manifest and an ES module
// whose default export is an HTMLElement class. Graphics come from the repo
// (docker/obs/overlay/graphics/, read-only) and from admins' uploads
// ($HOME/graphics, obs-home volume). The layers (which graphic, its data,
// playing, step) are kept in obs-home and every change is pushed to the page
// over server-sent events, with the command that caused it so the page can
// animate it.
const HOME = process.env.HOME ?? '/home/obs';
const OVERLAY_INPUT = 'Overlays';
const OVERLAY_DIR = '/opt/obs-overlay';
const OVERLAY_URL = `http://127.0.0.1:${Number(process.env.OBS_DOOR_PORT) || 4458}/obs/overlay/`;
const GRAPHICS_SOURCES = { repo: join(OVERLAY_DIR, 'graphics'), uploads: join(HOME, 'graphics') };
const LAYERS_FILE = join(HOME, 'graphics-layers.json');
// Viewer chat for graphic eac-chat: the stream-chat collector on eac-network.
const STREAM_CHAT_URL = process.env.STREAM_CHAT_URL || 'http://stream-chat:4459';
const SAFE_FOLDER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SAFE_SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9 _.()+-]{0,99}$/;
const UPLOAD_TYPES = new Set(['.mjs', '.js', '.json', '.css', '.html', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm']);
const UPLOAD_MAX_BYTES = 25_000_000;
const MAX_LAYERS = 16;
const safeRelPath = (p) => typeof p === 'string' && p.split('/').every((seg) => SAFE_SEGMENT.test(seg) && seg !== '..');

/** @type {Map<string, any>} graphic id → catalog entry */
let catalog = new Map();
async function scanGraphics() {
  const next = new Map();
  for (const [source, dir] of Object.entries(GRAPHICS_SOURCES)) {
    const folders = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const f of folders) {
      if (!f.isDirectory() || !SAFE_FOLDER.test(f.name)) continue;
      const files = (await readdir(join(dir, f.name)).catch(() => [])).filter((n) => n.endsWith('.ograf.json'));
      for (const file of files) {
        try {
          const m = JSON.parse(await readFile(join(dir, f.name, file), 'utf8'));
          if (typeof m.id !== 'string' || !m.id || m.id.includes('/') || !safeRelPath(m.main) || m.supportsRealTime !== true) {
            log(`graphic ${source}/${f.name}/${file} skipped: needs id, main and supportsRealTime`);
            continue;
          }
          if (next.has(m.id)) {
            log(`graphic ${source}/${f.name} skipped: id "${m.id}" is already used`);
            continue;
          }
          next.set(m.id, {
            id: m.id,
            name: String(m.name ?? m.id),
            description: String(m.description ?? ''),
            version: m.version ?? null,
            author: m.author && typeof m.author.name === 'string' ? { name: m.author.name, url: m.author.url ?? null } : null,
            source,
            folder: f.name,
            main: m.main,
            schema: m.schema && typeof m.schema === 'object' ? m.schema : null,
            stepCount: Number.isInteger(m.stepCount) ? m.stepCount : 1,
            customActions: (Array.isArray(m.customActions) ? m.customActions : [])
              .filter((a) => a && typeof a.id === 'string')
              .map((a) => ({ id: a.id, name: String(a.name ?? a.id), description: String(a.description ?? ''), schema: a.schema ?? null })),
          });
        } catch (e) {
          log(`graphic ${source}/${f.name}/${file}: ${e.message}`);
        }
      }
    }
  }
  catalog = next;
}

/** Defaults from a JSON Schema's `default`s, objects followed one level at a time. */
function schemaDefaults(schema) {
  if (!schema || typeof schema !== 'object') return undefined;
  if (schema.default !== undefined) return structuredClone(schema.default);
  if (schema.type === 'object' && schema.properties) {
    const out = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      const d = schemaDefaults(v);
      if (d !== undefined) out[k] = d;
    }
    return out;
  }
  return undefined;
}

const cleanData = (d) => {
  const json = JSON.stringify(d && typeof d === 'object' && !Array.isArray(d) ? d : {});
  if (json.length > 20_000) throw new Error('Graphic data too large');
  return JSON.parse(json);
};

/** @type {{id: string, graphicId: string, data: object, playing: boolean, step: number}[]} */
let layers = [];
try {
  layers = JSON.parse(readFileSync(LAYERS_FILE, 'utf8')).filter((l) => l && typeof l.id === 'string' && typeof l.graphicId === 'string');
} catch { /* first start */ }

/** @type {Set<import('node:http').ServerResponse>} */
const overlayClients = new Set();
const graphicsView = () => ({ catalog: [...catalog.values()], layers });
function pushGraphics(last = null) {
  const line = `data: ${JSON.stringify({ ...graphicsView(), last })}\n\n`;
  for (const res of overlayClients) res.write(line);
  writeFile(LAYERS_FILE, JSON.stringify(layers)).catch((e) => log('layers not saved:', e.message));
}

/** One operator command on the layers; returns the new view. */
function graphicsCommand(b) {
  const op = String(b.op ?? '');
  const layer = layers.find((l) => l.id === b.layerId);
  const need = () => {
    if (!layer) throw new Error('No such layer');
    return layer;
  };
  let last = { op, layerId: b.layerId ?? null };
  switch (op) {
    case 'add': {
      const g = catalog.get(String(b.graphicId ?? ''));
      if (!g) throw new Error('No such graphic');
      if (layers.length >= MAX_LAYERS) throw new Error(`At most ${MAX_LAYERS} layers`);
      const l = { id: randomBytes(6).toString('hex'), graphicId: g.id, data: cleanData({ ...(schemaDefaults(g.schema) ?? {}), ...(b.data ?? {}) }), playing: false, step: 0 };
      layers.push(l);
      last = { op, layerId: l.id };
      break;
    }
    case 'remove':
      need();
      layers = layers.filter((l) => l !== layer);
      break;
    case 'play':
      need().playing = true;
      layer.step = 0;
      break;
    case 'stop':
      need().playing = false;
      layer.step = 0;
      break;
    case 'update':
      need().data = cleanData(b.data);
      break;
    case 'step': {
      const l = need();
      const delta = Number.isInteger(b.delta) ? b.delta : 1;
      const count = catalog.get(l.graphicId)?.stepCount ?? 1;
      if (!l.playing) throw new Error('Play the graphic first');
      l.step = Math.max(0, l.step + delta);
      // Past the last step the graphic plays out (OGraf: transitions to the end).
      if (count >= 0 && l.step >= count) {
        l.playing = false;
        l.step = 0;
      }
      last = { op, layerId: l.id, delta };
      break;
    }
    case 'custom': {
      const l = need();
      const action = catalog.get(l.graphicId)?.customActions.find((a) => a.id === b.actionId);
      if (!action) throw new Error('No such action');
      last = { op, layerId: l.id, actionId: action.id, payload: cleanData(b.payload) };
      break;
    }
    case 'move': {
      const l = need();
      const to = Math.max(0, Math.min(layers.length - 1, layers.indexOf(l) + (b.delta === -1 ? -1 : 1)));
      layers = layers.filter((x) => x !== l);
      layers.splice(to, 0, l);
      break;
    }
    case 'clear':
      for (const l of layers) {
        l.playing = false;
        l.step = 0;
      }
      break;
    default:
      throw new Error('Unknown command');
  }
  pushGraphics(last);
  return graphicsView();
}

/** An admin's OGraf folder: checked, written beside the others, then scanned. */
async function uploadGraphic(b) {
  const folder = String(b.folder ?? '');
  if (!SAFE_FOLDER.test(folder)) throw new Error('Folder name: letters, digits, dot, dash, underscore');
  const files = Array.isArray(b.files) ? b.files : [];
  if (!files.length || files.length > 200) throw new Error('Between 1 and 200 files');
  let total = 0;
  const decoded = files.map((f) => {
    if (!safeRelPath(f.path) || !UPLOAD_TYPES.has(extname(f.path).toLowerCase())) throw new Error(`Not allowed: ${String(f.path).slice(0, 80)}`);
    const buf = Buffer.from(String(f.data ?? ''), 'base64');
    total += buf.length;
    return { path: f.path, buf };
  });
  if (total > UPLOAD_MAX_BYTES) throw new Error('More than 25 MB');
  if (!decoded.some((f) => !f.path.includes('/') && f.path.endsWith('.ograf.json'))) throw new Error('No *.ograf.json at the top of the folder');
  const root = GRAPHICS_SOURCES.uploads;
  const tmp = join(root, `.upload-${randomBytes(4).toString('hex')}`);
  await mkdir(tmp, { recursive: true });
  try {
    for (const f of decoded) {
      await mkdir(join(tmp, posix.dirname(f.path)), { recursive: true });
      await writeFile(join(tmp, f.path), f.buf);
    }
    await rm(join(root, folder), { recursive: true, force: true });
    await rename(tmp, join(root, folder));
  } catch (e) {
    await rm(tmp, { recursive: true, force: true });
    throw e;
  }
  await scanGraphics();
  const found = [...catalog.values()].filter((g) => g.source === 'uploads' && g.folder === folder);
  if (!found.length) {
    await rm(join(root, folder), { recursive: true, force: true });
    await scanGraphics();
    throw new Error('No usable graphic in that folder (manifest needs id, main, supportsRealTime: true, and an id not already used)');
  }
  log(`graphic folder uploaded: ${folder} (${found.map((g) => g.id).join(', ')}, ${total} bytes)`);
  pushGraphics({ op: 'catalog' });
  return graphicsView();
}

async function deleteGraphic(b) {
  const folder = String(b.folder ?? '');
  if (!SAFE_FOLDER.test(folder)) throw new Error('Bad folder');
  const ids = new Set([...catalog.values()].filter((g) => g.source === 'uploads' && g.folder === folder).map((g) => g.id));
  layers = layers.filter((l) => !ids.has(l.graphicId));
  await rm(join(GRAPHICS_SOURCES.uploads, folder), { recursive: true, force: true });
  await scanGraphics();
  pushGraphics({ op: 'catalog' });
  return graphicsView();
}
await mkdir(GRAPHICS_SOURCES.uploads, { recursive: true }).catch(() => {});
await scanGraphics();

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
      // InputVolumeMeters (1 << 16): the console's mixer meters, about 20 a second.
      const ident = { rpcVersion: 1, eventSubscriptions: 1 << 16 };
      const auth = msg.d.authentication;
      if (auth) ident.authentication = sha256b64(sha256b64(PASSWORD + auth.salt) + auth.challenge);
      sock.send(JSON.stringify({ op: 1, d: ident }));
    } else if (msg.op === 2) {
      identified = true;
      attempts = 0;
      log('connected to OBS', msg.d.negotiatedRpcVersion);
      ensureScenes().catch((e) => log('scene setup failed:', e.message));
    } else if (msg.op === 5) {
      if (msg.d.eventType === 'InputVolumeMeters') {
        for (const i of msg.d.eventData.inputs) {
          // Peak of the loudest channel, as a 0..1 multiplier.
          levels.set(i.inputName, Math.max(0, ...i.inputLevelsMul.map((ch) => ch[1] ?? 0)));
        }
      }
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
  // The booth hears the page and the clip ("Monitor and Output" sends a copy
  // to the booth sink; the program mix is unchanged). Reapplied like the layout.
  for (const inputName of [BROWSER_INPUT, 'Media file']) {
    await call('SetInputAudioMonitorType', { inputName, monitorType: 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT' });
  }

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

  // Overlays: one transparent page (docker/obs/overlay/) on top of each
  // built-in scene, the same source in all three. Scenes made in the desktop
  // get it with "Add existing source".
  await add('Holding', OVERLAY_INPUT, 'browser_source', {});
  await call('SetInputSettings', {
    inputName: OVERLAY_INPUT,
    inputSettings: {
      url: OVERLAY_URL, width: W, height: H, fps: 30, reroute_audio: false, shutdown: false, restart_when_active: false,
      css: 'body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }',
    },
  });
  for (const sceneName of ['Holding', 'Browser', 'Media']) {
    const { sceneItems } = await call('GetSceneItemList', { sceneName });
    if (!sceneItems.some((i) => i.sourceName === OVERLAY_INPUT)) {
      await call('CreateSceneItem', { sceneName, sourceName: OVERLAY_INPUT, sceneItemEnabled: true });
    }
    await place(sceneName, OVERLAY_INPUT, fill);
  }

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
    // `.upload-…` files are conversions in progress.
    if (!safeFile(name) || name.startsWith('.')) continue;
    const s = await stat(join(REC_DIR, name));
    out.push({ name, size: s.size, modified: s.mtime.toISOString(), copy: copies.get(name) ?? null });
  }
  return out.sort((a, b) => b.modified.localeCompare(a.modified));
}

// Background copies into Nextcloud (the Studio's Recordings kind): one per
// file at a time; the state stays until the agent restarts.
const copies = new Map();

/** True when `file` is the one OBS is writing now. */
async function beingRecorded(file) {
  const rec = await call('GetRecordStatus').catch(() => null);
  if (!rec?.outputActive) return false;
  const [newest] = await listRecordings();
  return newest?.name === basename(file);
}

async function startCopy(file, path, by) {
  if (!safeFile(file)) throw new Error('Bad file name');
  if (copies.get(file)?.state === 'copying') return copies.get(file);
  if (await beingRecorded(file)) throw new Error('That recording is still going');
  const job = { state: 'copying', step: 'preparing', sent: 0, size: 0, path, by: String(by ?? '').slice(0, 80), at: new Date().toISOString(), error: null };
  copies.set(file, job);
  upload(file, path, job)
    .then(() => Object.assign(job, { state: 'done', step: null }))
    .catch((e) => Object.assign(job, { state: 'failed', step: null, error: e.message }))
    .finally(() => log(`recording copy ${file} → ${path}: ${job.state}${job.error ? ` (${job.error})` : ''}`));
  return job;
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
async function upload(file, path, job = null) {
  if (!safeFile(file)) throw new Error('Bad file name');
  // Only into someone's or some org's Private tree: the caller decides whose.
  if (!/^EAC_Network\/.+\/Private\/.+\.mp4$/.test(path) || path.includes('..')) throw new Error('Bad target path');
  const src = join(REC_DIR, file);
  let mp4 = src;
  if (!/\.mp4$/i.test(file)) {
    mp4 = join(REC_DIR, `.upload-${Date.now()}.mp4`);
    if (job) job.step = 'converting';
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-c', 'copy', '-movflags', '+faststart', mp4]);
  }
  try {
    await davMkcols(path.split('/').slice(0, -1).join('/'));
    const size = (await stat(mp4)).size;
    const url = `${NC_URL}/remote.php/dav/files/${encodeURIComponent(NC_USER)}/${path.split('/').map(encodeURIComponent).join('/')}`;
    const stream = createReadStream(mp4);
    if (job) {
      Object.assign(job, { step: 'sending', size, sent: 0 });
      stream.on('data', (c) => (job.sent += c.length));
    }
    const r = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: NC_AUTH, 'Content-Type': 'video/mp4', 'Content-Length': String(size) },
      body: stream,
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
    graphics: graphicsView(),
    cameras: [...cameras.values()].map((c) => ({ name: c.source, since: new Date(c.since).toISOString(), bytes: c.bytes })),
    lock: lockView(),
  };
}

function authorized(req) {
  const got = Buffer.from(String(req.headers.authorization ?? ''));
  const want = Buffer.from(`Bearer ${SECRET}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function body(req, limit = 10_000) {
  let s = '';
  for await (const c of req) {
    s += c;
    if (s.length > limit) throw new Error('Body too large');
  }
  return s ? JSON.parse(s) : {};
}

const RELAY_OBS_PASS = process.env.RELAY_OBS_PASS ?? '';
const RELAY_RTMP = 'rtmp://relay:1935';
// Feeds are read over RTSP (2026-11-01): browser guests publish Opus over
// WHIP, which the relay's RTMP side does not carry; RTSP carries every codec.
const RELAY_RTSP = 'rtsp://relay:8554';

async function addFeedScene(key, label) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(key)) throw new Error('Bad feed key');
  if (!RELAY_OBS_PASS) throw new Error('RELAY_OBS_PASS is not set in the obs container');
  const name = label.replace(/[^\p{L}\p{N} ._'()-]+/gu, ' ').trim().slice(0, 40) || 'Feed';
  const sceneName = `Feed · ${name}`;
  const inputName = `${sceneName} (source)`;
  const inputSettings = {
    is_local_file: false,
    input: `${RELAY_RTSP.replace('://', `://obs:${RELAY_OBS_PASS}@`)}/in/${key}`,
    input_format: '',
    // The relay offers RTSP over TCP only; without this ffmpeg tries UDP first (461).
    ffmpeg_options: 'rtsp_transport=tcp',
    reconnect_delay_sec: 2,
    restart_on_activate: true,
    close_when_inactive: true,
    buffering_mb: 1,
  };
  const { scenes } = await call('GetSceneList');
  if (!scenes.some((s) => s.sceneName === sceneName)) await call('CreateScene', { sceneName });
  const { inputs } = await call('GetInputList');
  if (inputs.some((i) => i.inputName === inputName)) {
    await call('SetInputSettings', { inputName, inputSettings });
  } else {
    await call('CreateInput', { sceneName, inputName, inputKind: 'ffmpeg_source', inputSettings, sceneItemEnabled: true });
  }
  const { sceneItemId } = await call('GetSceneItemId', { sceneName, sourceName: inputName });
  await call('SetSceneItemTransform', {
    sceneName, sceneItemId,
    sceneItemTransform: { positionX: 0, positionY: 0, alignment: 5, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsAlignment: 0, boundsWidth: W, boundsHeight: H },
  });
  log(`feed scene ready: ${sceneName}`);
  return { scene: sceneName };
}

// ---------------------------------------------------------------------------
// Studio: scenes, sources, layouts, transitions and audio, for the console's
// scene editor (packages/reels/src/broadcast/SceneEditor.tsx). Everything a
// session needs without opening the OBS desktop.
// ---------------------------------------------------------------------------

const MEDIA_DIR = join(HOME, 'media');
await mkdir(MEDIA_DIR, { recursive: true }).catch(() => {});
// The agent's own sources: not renamed or deleted from the console (ensureScenes recreates them).
const BUILT_IN_INPUTS = new Set([BROWSER_INPUT, 'Media file', OVERLAY_INPUT, 'Holding background', 'Holding text']);
const AUDIO_KINDS = new Set(['browser_source', 'ffmpeg_source', 'pulse_input_capture', 'pulse_output_capture', 'vlc_source']);
/** Latest peak per input (0..1), from InputVolumeMeters. */
const levels = new Map();

/** Frame-relative layout presets: [x, y, width, height] as fractions of the canvas. */
const LAYOUTS = {
  fill: [0, 0, 1, 1],
  left: [0, 0, 0.5, 1],
  right: [0.5, 0, 0.5, 1],
  center: [0.15, 0.15, 0.7, 0.7],
  'pip-br': [0.675, 0.675, 0.3, 0.3],
  'pip-bl': [0.025, 0.675, 0.3, 0.3],
  'pip-tr': [0.675, 0.025, 0.3, 0.3],
  'pip-tl': [0.025, 0.025, 0.3, 0.3],
  lower: [0.05, 0.72, 0.9, 0.22],
  // Out of frame: heard, not seen (a Talk room or a stream used for its sound).
  audio: [1.05, 0, 0.01, 0.01],
};
const layoutTransform = (preset) => {
  const [x, y, w, h] = LAYOUTS[preset] ?? LAYOUTS.fill;
  return {
    positionX: Math.round(x * W), positionY: Math.round(y * H), alignment: 5, rotation: 0,
    boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsAlignment: 0, boundsWidth: Math.max(2, Math.round(w * W)), boundsHeight: Math.max(2, Math.round(h * H)),
    cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0,
  };
};

const nameOk = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 80 && !/[\u0000-\u001f]/.test(v);
const httpUrl = (v) => {
  const u = String(v ?? '').trim();
  if (!/^https?:\/\//i.test(u) && !/^(rtmps?|srt|rtsp):\/\//i.test(u)) throw new Error('Use an http(s), rtmp, srt or rtsp address');
  return u;
};
/** "#rrggbb" → OBS's ABGR integer (alpha opaque). */
const obsColor = (hex) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex ?? ''));
  if (!m) return 0xffffffff;
  return (0xff000000 | (parseInt(m[3], 16) << 16) | (parseInt(m[2], 16) << 8) | parseInt(m[1], 16)) >>> 0;
};
const hexColor = (abgr) => {
  const n = Number(abgr) >>> 0;
  const h = (v) => (v & 0xff).toString(16).padStart(2, '0');
  return `#${h(n)}${h(n >> 8)}${h(n >> 16)}`;
};

async function takenNames() {
  const [{ inputs }, { scenes }] = await Promise.all([call('GetInputList'), call('GetSceneList')]);
  return new Set([...inputs.map((i) => i.inputName), ...scenes.map((s) => s.sceneName)]);
}
/** Inputs and scenes share one name space in OBS: "Name", "Name 2", … */
async function uniqueName(base) {
  const taken = await takenNames();
  const b = String(base ?? '').trim().slice(0, 70) || 'Source';
  let n = b;
  for (let i = 2; taken.has(n); i++) n = `${b} ${i}`;
  return n;
}

async function keepOverlaysOnTop(sceneName) {
  const { sceneItems } = await call('GetSceneItemList', { sceneName });
  const ov = sceneItems.find((i) => i.sourceName === OVERLAY_INPUT);
  const top = Math.max(...sceneItems.map((i) => i.sceneItemIndex));
  if (ov && ov.sceneItemIndex !== top) await call('SetSceneItemIndex', { sceneName, sceneItemId: ov.sceneItemId, sceneItemIndex: top });
}

async function studioView() {
  const [sceneList, { inputs }, tr, cur, studio] = await Promise.all([
    call('GetSceneList'), call('GetInputList'), call('GetSceneTransitionList'), call('GetCurrentSceneTransition'), call('GetStudioModeEnabled'),
  ]);
  const scenes = [];
  // GetSceneList lists the bottom scene first; OBS shows the last one on top.
  for (const s of [...sceneList.scenes].reverse()) {
    const { sceneItems } = await call('GetSceneItemList', { sceneName: s.sceneName });
    scenes.push({
      name: s.sceneName,
      // Top of the stack first, as in OBS's Sources list.
      items: [...sceneItems].sort((a, b) => b.sceneItemIndex - a.sceneItemIndex).map((it) => ({
        id: it.sceneItemId,
        source: it.sourceName,
        kind: it.inputKind ?? (it.isGroup ? 'group' : 'scene'),
        enabled: it.sceneItemEnabled,
        builtIn: BUILT_IN_INPUTS.has(it.sourceName),
      })),
    });
  }
  const audio = [];
  for (const i of inputs) {
    if (!AUDIO_KINDS.has(i.inputKind)) continue;
    try {
      // A browser source is heard only with "Control audio via OBS" on.
      if (i.inputKind === 'browser_source' && (await call('GetInputSettings', { inputName: i.inputName })).inputSettings.reroute_audio !== true) continue;
      const [v, m, mon] = await Promise.all([
        call('GetInputVolume', { inputName: i.inputName }),
        call('GetInputMute', { inputName: i.inputName }),
        call('GetInputAudioMonitorType', { inputName: i.inputName }),
      ]);
      audio.push({ name: i.inputName, kind: i.inputKind, volumeDb: v.inputVolumeDb, muted: m.inputMuted, monitor: mon.monitorType !== 'OBS_MONITORING_TYPE_NONE' });
    } catch { /* not an audio source after all */ }
  }
  return {
    scenes,
    program: sceneList.currentProgramSceneName,
    preview: studio.studioModeEnabled ? sceneList.currentPreviewSceneName : null,
    studioMode: studio.studioModeEnabled,
    transitions: tr.transitions.map((t) => t.transitionName),
    transition: tr.currentSceneTransitionName,
    transitionMs: cur.transitionFixed ? null : cur.transitionDuration ?? null,
    audio,
    layouts: Object.keys(LAYOUTS),
  };
}

/** The settings the console may read and change, per kind. */
async function sourceSettings(name) {
  const { inputKind, inputSettings: s } = await call('GetInputSettings', { inputName: String(name) });
  switch (inputKind) {
    case 'browser_source': return { kind: inputKind, url: s.url ?? '', audio: s.reroute_audio !== false };
    case 'ffmpeg_source': return { kind: inputKind, local: s.is_local_file !== false, file: s.is_local_file === false ? '' : basename(String(s.local_file ?? '')), url: s.input ?? '', loop: !!s.looping };
    case 'image_source': return { kind: inputKind, file: basename(String(s.file ?? '')) };
    case 'text_ft2_source_v2': return { kind: inputKind, text: s.text ?? '', size: s.font?.size ?? 72, color: hexColor(s.color1 ?? 0xffffffff) };
    case 'color_source_v3': return { kind: inputKind, color: hexColor(s.color ?? 0xffffffff) };
    default: return { kind: inputKind };
  }
}

/** Copy a file from Nextcloud into the media folder (reused when the same size is already there). */
async function fetchMedia(path) {
  if (!/^EAC_Network\/.+\.[A-Za-z0-9]{2,5}$/.test(path) || path.includes('..')) throw new Error('Bad media path');
  const url = `${NC_URL}/remote.php/dav/files/${encodeURIComponent(NC_USER)}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, { headers: { Authorization: NC_AUTH } });
  if (!res.ok || !res.body) throw new Error(`Storage answered ${res.status}`);
  const name = `${createHash('sha1').update(path).digest('hex').slice(0, 10)}-${basename(path).replace(/[^\w.() +-]+/g, '_')}`;
  const file = join(MEDIA_DIR, name);
  const size = Number(res.headers.get('content-length')) || -1;
  const have = await stat(file).catch(() => null);
  if (have && have.size === size) {
    await res.body.cancel();
    return file;
  }
  const tmp = `${file}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  await rename(tmp, file);
  log(`media fetched: ${path} (${(await stat(file)).size} bytes)`);
  return file;
}

// Stinger transitions (2026-11-01, Collect Art FX pack). obs-websocket 5
// cannot create a transition, so a Stinger is made once in the OBS desktop
// (Scene Transitions, +, Stinger, any name); `transition.stinger` then points
// it at a video in track-matte mode. The file comes from the person's files
// (`path`, resolved by the services layer like media) or from a graphic
// folder (`graphic: {folder, file}`, e.g. the uploaded ca-fx-stingers), and
// is copied into ~/media/stingers so a later upload or delete of the folder
// does not pull it from under OBS.
const STINGER_DIR = join(MEDIA_DIR, 'stingers');
const STINGER_TYPES = new Set(['.webm', '.mov', '.mp4', '.mkv']);
const MATTE_LAYOUTS = { 'side-by-side': 0, stacked: 1, none: null };

async function stingerFile(b) {
  if (b.graphic && typeof b.graphic === 'object') {
    const folder = String(b.graphic.folder ?? '');
    const file = String(b.graphic.file ?? '');
    if (!SAFE_FOLDER.test(folder) || !safeRelPath(file) || !STINGER_TYPES.has(extname(file).toLowerCase())) throw new Error('Bad graphic file');
    for (const dir of [GRAPHICS_SOURCES.uploads, GRAPHICS_SOURCES.repo]) {
      const src = join(dir, folder, file);
      if (!(await stat(src).catch(() => null))?.isFile()) continue;
      await mkdir(STINGER_DIR, { recursive: true });
      const dest = join(STINGER_DIR, `${folder}-${basename(file)}`);
      // A new inode: OBS keeps reading the old file until the settings change.
      await copyFile(src, `${dest}.part`);
      await rename(`${dest}.part`, dest);
      return dest;
    }
    throw new Error('No such file in the graphics');
  }
  const path = String(b.path ?? '');
  if (!STINGER_TYPES.has(extname(path).toLowerCase())) throw new Error('A stinger is a video file (.webm, .mov, .mp4, .mkv)');
  return fetchMedia(path);
}

async function setStinger(b) {
  const name = String(b.name ?? '');
  const { transitions, currentSceneTransitionName } = await call('GetSceneTransitionList');
  const t = transitions.find((x) => x.transitionName === name);
  if (!t) throw new Error(`No transition called "${name}": make a Stinger with that name once in the desktop (Scene Transitions, +, Stinger)`);
  if (t.transitionKind !== 'obs_stinger_transition') throw new Error(`"${name}" is not a Stinger`);
  const layout = MATTE_LAYOUTS[String(b.matte ?? 'stacked')];
  if (layout === undefined) throw new Error('matte: stacked, side-by-side or none');
  const file = await stingerFile(b);
  const transitionSettings = {
    path: file,
    track_matte_enabled: layout !== null,
    ...(layout !== null ? { track_matte_layout: layout } : {}),
    invert_matte: false,
    // Milliseconds. With a track matte the matte decides what shows; the point only moves the audio over.
    tp_type: 0,
    transition_point: Math.max(0, Math.min(10_000, Math.round(Number(b.point) || 1000))),
    // VP9 with alpha decodes in software (libvpx); a hardware decoder would drop the alpha.
    hw_decode: false,
    preload: false,
    audio_monitoring: 0,
  };
  // obs-websocket sets settings on the current transition only: make it current, set, and switch back unless `use`.
  await call('SetCurrentSceneTransition', { transitionName: name });
  try {
    await call('SetCurrentSceneTransitionSettings', { transitionSettings, overlay: true });
  } finally {
    if (!b.use && currentSceneTransitionName && currentSceneTransitionName !== name) {
      await call('SetCurrentSceneTransition', { transitionName: currentSceneTransitionName }).catch(() => {});
    }
  }
  log(`stinger "${name}" → ${file}${layout !== null ? ` (track matte ${String(b.matte ?? 'stacked')})` : ''}`);
}

const AUDIO_MONITOR = 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT';

async function addSource(b) {
  const sceneName = String(b.scene ?? '');
  const kind = String(b.kind ?? '');
  if (kind === 'existing') {
    const src = String(b.source ?? '');
    const { sceneItemId } = await call('CreateSceneItem', { sceneName, sourceName: src, sceneItemEnabled: true });
    await call('SetSceneItemTransform', { sceneName, sceneItemId, sceneItemTransform: layoutTransform(b.layout ?? 'fill') });
    await keepOverlaysOnTop(sceneName);
    return;
  }
  const defaults = { web: 'Web page', talk: 'Talk room', media: 'Media', stream: 'Stream', image: 'Image', text: 'Text', colour: 'Colour' };
  if (!defaults[kind]) throw new Error('Unknown source kind');
  let inputKind;
  let inputSettings;
  let layout = b.layout;
  switch (kind) {
    case 'web':
      inputKind = 'browser_source';
      inputSettings = { url: httpUrl(b.url), width: W, height: H, fps: 30, reroute_audio: true, shutdown: true };
      break;
    case 'talk':
      // Stays loaded while off air: leaving the call and rejoining needs clicks.
      inputKind = 'browser_source';
      inputSettings = { url: httpUrl(b.url), width: W, height: H, fps: 30, reroute_audio: true, shutdown: false };
      break;
    case 'media': {
      inputKind = 'ffmpeg_source';
      const file = await fetchMedia(String(b.path ?? ''));
      inputSettings = { is_local_file: true, local_file: file, looping: !!b.loop, restart_on_activate: true, close_when_inactive: false };
      break;
    }
    case 'stream':
      inputKind = 'ffmpeg_source';
      inputSettings = { is_local_file: false, input: httpUrl(b.url), reconnect_delay_sec: 2, restart_on_activate: true };
      break;
    case 'image':
      inputKind = 'image_source';
      inputSettings = { file: await fetchMedia(String(b.path ?? '')) };
      break;
    case 'text':
      inputKind = 'text_ft2_source_v2';
      inputSettings = {
        text: String(b.text ?? 'Text').slice(0, 500),
        font: { face: 'DejaVu Sans', size: Math.min(300, Math.max(12, Number(b.size) || 72)), style: 'Regular', flags: 0 },
        color1: obsColor(b.color ?? '#ffffff'), color2: obsColor(b.color ?? '#ffffff'),
      };
      break;
    case 'colour':
      inputKind = 'color_source_v3';
      inputSettings = { color: obsColor(b.color ?? '#141110'), width: W, height: H };
      break;
  }
  const inputName = await uniqueName(nameOk(b.name) ? b.name : defaults[kind]);
  const { sceneItemId } = await call('CreateInput', { sceneName, inputName, inputKind, inputSettings, sceneItemEnabled: true });
  if (AUDIO_KINDS.has(inputKind)) await call('SetInputAudioMonitorType', { inputName, monitorType: AUDIO_MONITOR }).catch(() => {});
  // A colour is a background: under everything else.
  if (kind === 'colour') await call('SetSceneItemIndex', { sceneName, sceneItemId, sceneItemIndex: 0 });
  // Text keeps its font size (no bounds) unless a layout is asked for.
  const transform = kind === 'text' && !LAYOUTS[layout]
    ? { positionX: Math.round(W * 0.05), positionY: Math.round(H * 0.8), alignment: 5, boundsType: 'OBS_BOUNDS_NONE', scaleX: 1, scaleY: 1, rotation: 0 }
    : layoutTransform(layout ?? 'fill');
  await call('SetSceneItemTransform', { sceneName, sceneItemId, sceneItemTransform: transform });
  await keepOverlaysOnTop(sceneName);
}

async function updateSource(b) {
  const inputName = String(b.name ?? '');
  const { inputKind, inputSettings: cur } = await call('GetInputSettings', { inputName });
  const s = b.settings ?? {};
  const next = {};
  if (inputKind === 'browser_source') {
    if (s.url !== undefined) next.url = httpUrl(s.url);
    if (s.audio !== undefined) next.reroute_audio = !!s.audio;
  } else if (inputKind === 'ffmpeg_source') {
    if (s.path) Object.assign(next, { is_local_file: true, local_file: await fetchMedia(String(s.path)) });
    if (s.url) Object.assign(next, { is_local_file: false, input: httpUrl(s.url) });
    if (s.loop !== undefined) next.looping = !!s.loop;
  } else if (inputKind === 'image_source') {
    if (s.path) next.file = await fetchMedia(String(s.path));
  } else if (inputKind === 'text_ft2_source_v2') {
    if (s.text !== undefined) next.text = String(s.text).slice(0, 500);
    if (s.size !== undefined) next.font = { ...(cur.font ?? { face: 'DejaVu Sans', style: 'Regular', flags: 0 }), size: Math.min(300, Math.max(12, Number(s.size) || 72)) };
    if (s.color !== undefined) next.color1 = next.color2 = obsColor(s.color);
  } else if (inputKind === 'color_source_v3') {
    if (s.color !== undefined) next.color = obsColor(s.color);
  } else throw new Error('This source is edited in the desktop');
  await call('SetInputSettings', { inputName, inputSettings: next, overlay: true });
}

async function removeItem(b) {
  const sceneName = String(b.scene ?? '');
  const sceneItemId = Number(b.id);
  const { sceneItems } = await call('GetSceneItemList', { sceneName });
  const item = sceneItems.find((i) => i.sceneItemId === sceneItemId);
  if (!item) throw new Error('No such source in this scene');
  await call('RemoveSceneItem', { sceneName, sceneItemId });
  // An input no scene uses any more is deleted too (OBS would keep it).
  if (item.inputKind && !BUILT_IN_INPUTS.has(item.sourceName)) {
    const { scenes } = await call('GetSceneList');
    for (const sc of scenes) {
      const { sceneItems: other } = await call('GetSceneItemList', { sceneName: sc.sceneName });
      if (other.some((i) => i.sourceName === item.sourceName)) return;
    }
    await call('RemoveInput', { inputName: item.sourceName });
  }
}

async function studioCommand(b) {
  const op = String(b.op ?? '');
  switch (op) {
    case 'scene.create': {
      if (!nameOk(b.name)) throw new Error('Give the scene a name');
      const sceneName = await uniqueName(b.name);
      await call('CreateScene', { sceneName });
      // New scenes carry the graphics like the built-in ones.
      const { sceneItemId } = await call('CreateSceneItem', { sceneName, sourceName: OVERLAY_INPUT, sceneItemEnabled: true });
      await call('SetSceneItemTransform', { sceneName, sceneItemId, sceneItemTransform: layoutTransform('fill') });
      break;
    }
    case 'scene.rename':
      if (!nameOk(b.to)) throw new Error('Give the scene a name');
      await call('SetSceneName', { sceneName: String(b.name), newSceneName: await uniqueName(b.to) });
      break;
    case 'scene.remove': {
      const { scenes, currentProgramSceneName } = await call('GetSceneList');
      if (scenes.length <= 1) throw new Error('OBS needs at least one scene');
      if (b.name === currentProgramSceneName) throw new Error('Switch away from this scene first');
      await call('RemoveScene', { sceneName: String(b.name) });
      break;
    }
    case 'scene.switch': {
      const { studioModeEnabled } = await call('GetStudioModeEnabled');
      await call(studioModeEnabled ? 'SetCurrentPreviewScene' : 'SetCurrentProgramScene', { sceneName: String(b.name) });
      break;
    }
    case 'scene.take':
      await call('TriggerStudioModeTransition');
      break;
    case 'studio.mode':
      await call('SetStudioModeEnabled', { studioModeEnabled: !!b.on });
      break;
    case 'transition':
      if (b.name) await call('SetCurrentSceneTransition', { transitionName: String(b.name) });
      if (Number.isFinite(b.ms)) await call('SetCurrentSceneTransitionDuration', { transitionDuration: Math.min(5000, Math.max(50, Math.round(b.ms))) }).catch(() => {});
      break;
    case 'transition.stinger':
      await setStinger(b);
      break;
    case 'source.add':
      await addSource(b);
      break;
    case 'source.remove':
      await removeItem(b);
      break;
    case 'source.toggle':
      await call('SetSceneItemEnabled', { sceneName: String(b.scene), sceneItemId: Number(b.id), sceneItemEnabled: !!b.enabled });
      break;
    case 'source.move': {
      const sceneName = String(b.scene);
      const { sceneItems } = await call('GetSceneItemList', { sceneName });
      const item = sceneItems.find((i) => i.sceneItemId === Number(b.id));
      if (!item) throw new Error('No such source in this scene');
      const top = Math.max(...sceneItems.map((i) => i.sceneItemIndex));
      const to = Math.max(0, Math.min(top, item.sceneItemIndex + (b.delta === -1 ? -1 : 1)));
      await call('SetSceneItemIndex', { sceneName, sceneItemId: item.sceneItemId, sceneItemIndex: to });
      await keepOverlaysOnTop(sceneName);
      break;
    }
    case 'source.layout':
      if (!LAYOUTS[b.preset]) throw new Error('Unknown layout');
      await call('SetSceneItemTransform', { sceneName: String(b.scene), sceneItemId: Number(b.id), sceneItemTransform: layoutTransform(b.preset) });
      break;
    case 'source.rename':
      if (BUILT_IN_INPUTS.has(b.name)) throw new Error('The studio’s own sources keep their names');
      if (!nameOk(b.to)) throw new Error('Give the source a name');
      await call('SetInputName', { inputName: String(b.name), newInputName: await uniqueName(b.to) });
      break;
    case 'source.update':
      await updateSource(b);
      break;
    case 'media.action': {
      const actions = { play: 'PLAY', pause: 'PAUSE', restart: 'RESTART', stop: 'STOP' };
      if (!actions[b.action]) throw new Error('Unknown media action');
      await call('TriggerMediaInputAction', { inputName: String(b.name), mediaAction: `OBS_WEBSOCKET_MEDIA_INPUT_ACTION_${actions[b.action]}` });
      break;
    }
    case 'audio.volume':
      await call('SetInputVolume', { inputName: String(b.name), inputVolumeDb: Math.min(26, Math.max(-100, Number(b.db) || 0)) });
      break;
    case 'audio.mute':
      await call('SetInputMute', { inputName: String(b.name), inputMuted: !!b.muted });
      break;
    case 'audio.monitor':
      await call('SetInputAudioMonitorType', { inputName: String(b.name), monitorType: b.on ? AUDIO_MONITOR : 'OBS_MONITORING_TYPE_NONE' });
      break;
    default:
      throw new Error('Unknown command');
  }
  return studioView();
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
  'GET /studio': () => studioView(),
  'POST /studio': (b) => studioCommand(b),
  'POST /studio/source': (b) => sourceSettings(b.name),
  'GET /graphics': async () => {
    await scanGraphics();
    return graphicsView();
  },
  'POST /graphics': (b) => graphicsCommand(b),
  'POST /graphics/upload': (b) => uploadGraphic(b),
  'POST /graphics/delete': (b) => deleteGraphic(b),
  // After editing docker/obs/overlay/: OBS keeps the page it loaded.
  'POST /overlay/reload': () => call('PressInputPropertiesButton', { inputName: OVERLAY_INPUT, propertyName: 'refreshnocache' }),
  'POST /door/token': (b, req) => mintToken(String(req.headers['x-holder']), String(b.purpose ?? '')),
  // Stream relay (docker/relay): publish the program to the relay, which
  // copies it to every destination; the password stays in this container.
  'POST /stream/relay': () => {
    if (!RELAY_OBS_PASS) throw new Error('RELAY_OBS_PASS is not set in the obs container');
    return call('SetStreamServiceSettings', {
      streamServiceType: 'rtmp_custom',
      streamServiceSettings: { server: RELAY_RTMP, key: `program?user=obs&pass=${RELAY_OBS_PASS}`, use_auth: false },
    });
  },
  // A feed in on the relay as its own scene ("Feed · <label>"), its media
  // source filling the frame; switch to it or nest it in another scene.
  'POST /feeds/add': (b) => addFeedScene(String(b.key ?? ''), String(b.label ?? '')),
  'POST /recordings/upload': (b) => upload(b.file, b.path),
  'POST /recordings/copy': (b) => {
    if (!/^EAC_Network\/.+\/Private\/.+\.mp4$/.test(String(b.path ?? '')) || String(b.path).includes('..')) throw new Error('Bad target path');
    return startCopy(String(b.file ?? ''), String(b.path), b.by);
  },
  'POST /recordings/remove': async (b) => {
    if (!safeFile(b.file)) throw new Error('Bad file name');
    if (await beingRecorded(b.file)) throw new Error('That recording is still going');
    if (copies.get(b.file)?.state === 'copying') throw new Error('It is being copied');
    await rm(join(REC_DIR, basename(b.file)), { force: true });
    copies.delete(b.file);
    return {};
  },
  'POST /recordings/delete': async (b) => {
    if (!safeFile(b.file)) throw new Error('Bad file name');
    await rm(join(REC_DIR, basename(b.file)), { force: true });
    return {};
  },
};

// Finished recordings are not part of a live session: the Studio manages them
// without taking the booth from whoever has it.
const LEASE_FREE = new Set(['/lock', '/unlock', '/recordings/copy', '/recordings/remove']);

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
    if (req.method === 'POST' && !LEASE_FREE.has(path)) {
      if (!lockLive() || lock.holder !== String(req.headers['x-holder'] ?? '')) {
        return send(423, { error: lockLive() ? `The studio is in use by ${lock.name}` : 'Open the studio first' });
      }
      lock.seen = Date.now();
    }
    const data = await handler(req.method === 'POST' ? await body(req, path === '/graphics/upload' ? 40_000_000 : 10_000) : {}, req);
    send(200, data ?? {});
  } catch (err) {
    send(500, { error: err.message });
  }
}).listen(PORT, '0.0.0.0', () => log(`listening on ${PORT}`));

// ---------------------------------------------------------------------------
// The door (see the header)
// ---------------------------------------------------------------------------

const DOOR_PORT = Number(process.env.OBS_DOOR_PORT) || 4458;
const NOVNC = '/usr/share/novnc';
// websockify, bound to 127.0.0.1 in start.sh: only the door reaches it.
const VNC_WS_PORT = 6080;
const PURPOSES = new Set(['desktop', 'audio', 'program', 'levels', 'camera']);
const TOKEN_TTL_MS = 60_000;
/** @type {Map<string, {holder: string, purpose: string, exp: number}>} */
const tokens = new Map();
/** @type {Set<{holder: string, purpose: string, close: () => void}>} */
const doors = new Set();
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

function mintToken(holder, purpose) {
  if (!PURPOSES.has(purpose)) throw new Error('Unknown door');
  const now = Date.now();
  for (const [t, v] of tokens) if (v.exp < now) tokens.delete(t);
  const token = randomBytes(24).toString('base64url');
  tokens.set(token, { holder, purpose, exp: now + TOKEN_TTL_MS });
  return { token, expiresInMs: TOKEN_TTL_MS };
}

/** The holder a token was minted for, if it is fresh, for this door, and that holder still has the lease. Spent either way. */
function spendToken(token, purpose) {
  const key = String(token ?? '');
  const t = tokens.get(key);
  if (!t) return null;
  tokens.delete(key);
  if (t.exp < Date.now() || t.purpose !== purpose || !lockLive() || lock.holder !== t.holder) return null;
  return t.holder;
}

function openDoor(holder, purpose, close) {
  const d = { holder, purpose, close };
  doors.add(d);
  log(`${purpose} opened by ${lock?.name ?? '?'}`);
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    doors.delete(d);
    log(`${purpose} closed`);
  };
}

// An open connection keeps its holder's lease; a lost lease closes it.
setInterval(() => {
  for (const d of doors) {
    if (lockLive() && lock.holder === d.holder) lock.seen = Date.now();
    else {
      doors.delete(d);
      d.close();
    }
  }
}, 2000);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.oga': 'audio/ogg',
  '.mp3': 'audio/mpeg',
};

async function serveStatic(res, rel, root = NOVNC, cache = 'public, max-age=3600') {
  let clean;
  try {
    clean = posix.normalize('/' + decodeURIComponent(rel)).slice(1);
  } catch {
    clean = '';
  }
  const type = TYPES[extname(clean)];
  const s = type && !clean.split('/').includes('..') ? await stat(join(root, clean)).catch(() => null) : null;
  if (!s?.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('not found');
  }
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': s.size,
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(join(root, clean)).pipe(res);
}

/** The booth sink as it plays: what an operator would hear in headphones. */
function audioStream(res, holder) {
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
    'X-Audio-Format': 's16le; rate=48000; channels=2',
  });
  res.socket?.setNoDelay(true);
  const p = spawn('parec', ['--device=booth.monitor', '--format=s16le', '--rate=48000', '--channels=2', '--latency-msec=20', '--raw'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  p.stdout.pipe(res);
  res.socket?.setKeepAlive(true, 5000);
  const done = openDoor(holder, 'audio', () => res.destroy());
  // A listener that stops reading (gone without closing) backs the pipe up; drop it after 15 s.
  let lastDrain = Date.now();
  res.on('drain', () => (lastDrain = Date.now()));
  const watch = setInterval(() => {
    if (res.writableNeedDrain && Date.now() - lastDrain > 15_000) res.destroy();
    else if (!res.writableNeedDrain) lastDrain = Date.now();
  }, 5000);
  res.on('close', () => {
    clearInterval(watch);
    done();
    p.kill();
  });
  p.on('close', () => {
    done();
    res.end();
  });
}

/** The mixer's meters: every input's peak (0..1), ten times a second, as server-sent events. */
function levelsStream(res, holder) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
  const t = setInterval(() => res.write(`data: ${JSON.stringify(Object.fromEntries(levels))}\n\n`), 100);
  const done = openDoor(holder, 'levels', () => res.destroy());
  res.on('close', () => {
    clearInterval(t);
    done();
  });
}

/** The program scene as MJPEG, which an <img> plays without script. */
async function programStream(res, holder, fps, width) {
  const B = 'eacframe';
  res.writeHead(200, {
    'Content-Type': `multipart/x-mixed-replace; boundary=${B}`,
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
  });
  res.socket?.setNoDelay(true);
  let open = true;
  const done = openDoor(holder, 'program', () => res.destroy());
  res.on('close', () => {
    open = false;
    done();
  });
  res.write(`--${B}\r\n`);
  const gap = 1000 / fps;
  while (open) {
    const t0 = Date.now();
    try {
      const scene = (await call('GetCurrentProgramScene')).currentProgramSceneName;
      const shot = await call('GetSourceScreenshot', { sourceName: scene, imageFormat: 'jpg', imageWidth: width, imageCompressionQuality: 60 });
      const jpg = Buffer.from(shot.imageData.split(',')[1], 'base64');
      // The closing boundary goes out with the frame, so the browser shows it at once.
      const ok = res.write(Buffer.concat([
        Buffer.from(`Content-Type: image/jpeg\r\nContent-Length: ${jpg.length}\r\n\r\n`),
        jpg,
        Buffer.from(`\r\n--${B}\r\n`),
      ]));
      // A slow viewer gets fewer frames, not a growing queue.
      // A viewer that stops reading for 10 s (gone without closing) is dropped.
      if (!ok) {
        const drained = await Promise.race([new Promise((r) => res.once('drain', () => r(true))), sleep(10_000).then(() => false)]);
        if (!drained) {
          res.destroy();
          break;
        }
      }
    } catch {
      await sleep(1000);
    }
    await sleep(Math.max(0, gap - (Date.now() - t0)));
  }
}

const door = createServer((req, res) => {
  const u = new URL(req.url ?? '/', 'http://door');
  const deny = (code, msg) => {
    res.writeHead(code, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end(msg);
  };
  if (req.method !== 'GET') return deny(405, 'GET only');
  // Overlays: for OBS's own browser source only. Through the published port
  // the peer is Docker's gateway, never loopback.
  if (u.pathname.startsWith('/obs/overlay/')) {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) return deny(404, 'not found');
    const rest = u.pathname.slice('/obs/overlay/'.length);
    if (rest === 'state') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(graphicsView()));
    }
    if (rest === 'events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`retry: 2000\ndata: ${JSON.stringify({ ...graphicsView(), last: null })}\n\n`);
      overlayClients.add(res);
      const beat = setInterval(() => res.write(': beat\n\n'), 15_000);
      res.on('close', () => {
        clearInterval(beat);
        overlayClients.delete(res);
      });
      return;
    }
    if (rest === 'chat') {
      const q = new URLSearchParams({ minutes: u.searchParams.get('minutes') ?? '10', limit: u.searchParams.get('limit') ?? '20' });
      fetch(`${STREAM_CHAT_URL}/recent?${q}`, { signal: AbortSignal.timeout(3000) })
        .then(async (r) => {
          if (!r.ok) throw new Error(`stream-chat ${r.status}`);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(await r.text());
        })
        .catch(() => deny(502, 'chat unavailable'));
      return;
    }
    const g = /^graphics\/(repo|uploads)\/(.+)$/.exec(rest);
    if (g) return void serveStatic(res, g[2], GRAPHICS_SOURCES[g[1]], 'no-cache');
    // no-cache: an edited page shows on the next reload.
    return void serveStatic(res, rest || 'index.html', OVERLAY_DIR, 'no-cache');
  }
  if (u.pathname.startsWith('/obs/desktop/')) return void serveStatic(res, u.pathname.slice('/obs/desktop/'.length));
  if (u.pathname === '/obs/audio' || u.pathname === '/obs/program' || u.pathname === '/obs/levels') {
    const purpose = u.pathname.slice('/obs/'.length);
    const holder = spendToken(u.searchParams.get('token'), purpose);
    if (!holder) return deny(403, 'This link has expired or the studio is open elsewhere');
    if (purpose === 'audio') return audioStream(res, holder);
    if (purpose === 'levels') return levelsStream(res, holder);
    const fps = Math.min(10, Math.max(1, Number(u.searchParams.get('fps')) || 5));
    const width = Math.min(1280, Math.max(320, Number(u.searchParams.get('w')) || 640));
    return void programStream(res, holder, fps, width);
  }
  deny(404, 'not found');
});

// The desktop: check the token, then hand the websocket handshake (without
// the token) to websockify and splice the two sockets.

// ---------------------------------------------------------------------------
// Cameras: a browser's webcam into OBS. The console's Camera panel sends
// MediaRecorder chunks (WebM, or fragmented MP4 from Safari) over a websocket
// on the door; ffmpeg decodes them, re-encodes H.264 on the iGPU with a
// keyframe every second (so OBS can join at any moment) and sends MPEG-TS over
// loopback UDP to an OBS media source "Camera · <name>". One port per camera.
// ---------------------------------------------------------------------------

const CAMERA_PORT_BASE = 23000;
/** @type {Map<number, {source: string, since: number, bytes: number, ff: import('node:child_process').ChildProcess}>} port → camera */
const cameras = new Map();
const VAAPI = '/dev/dri/renderD128';

/** A minimal RFC 6455 server side: binary/text messages in, text out. */
function acceptWebSocket(req, socket, head) {
  const key = String(req.headers['sec-websocket-key'] ?? '');
  const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 5000);
  const handlers = { message: () => {}, close: () => {} };
  let buf = head?.length ? Buffer.from(head) : Buffer.alloc(0);
  let parts = [];
  let closed = false;
  const frame = (op, payload) => {
    const n = payload.length;
    const hdr = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x80 | op, 127, 0, 0, 0, 0]), Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])]);
    if (!socket.destroyed) socket.write(Buffer.concat([hdr, payload]));
  };
  const end = () => {
    if (closed) return;
    closed = true;
    handlers.close();
    socket.destroy();
  };
  const pump = () => {
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80;
      const op = buf[0] & 0x0f;
      const masked = buf[1] & 0x80;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        len = Number(buf.readBigUInt64BE(2));
        off = 10;
      }
      if (!masked || len > 16_000_000) return end();
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4);
      const data = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (op === 8) return end();
      if (op === 9) frame(10, data);
      else if (op === 0 || op === 1 || op === 2) {
        parts.push(data);
        if (fin) {
          const msg = Buffer.concat(parts);
          parts = [];
          handlers.message(msg, op === 1 || (op === 0 && false));
        }
      }
    }
  };
  socket.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    pump();
  });
  socket.on('close', end);
  socket.on('error', end);
  pump();
  return {
    on(ev, fn) { handlers[ev] = fn; },
    send(obj) { frame(1, Buffer.from(JSON.stringify(obj))); },
    close() { frame(8, Buffer.alloc(0)); setTimeout(() => socket.destroy(), 200); },
  };
}

async function cameraSource(name, port, sceneName, layout) {
  const input = `udp://127.0.0.1:${port}?fifo_size=1000000&overrun_nonfatal=1`;
  const settings = { is_local_file: false, input, buffering_mb: 1, reconnect_delay_sec: 1, restart_on_activate: false, close_when_inactive: false, clear_on_media_end: false, hw_decode: false };
  const { inputs } = await call('GetInputList');
  if (inputs.some((i) => i.inputName === name)) {
    await call('SetInputSettings', { inputName: name, inputSettings: settings, overlay: true });
  } else {
    await call('CreateInput', { sceneName, inputName: name, inputKind: 'ffmpeg_source', inputSettings: settings, sceneItemEnabled: true });
    await call('SetInputAudioMonitorType', { inputName: name, monitorType: AUDIO_MONITOR }).catch(() => {});
  }
  const { sceneItems } = await call('GetSceneItemList', { sceneName });
  let item = sceneItems.find((i) => i.sourceName === name);
  if (!item) {
    const { sceneItemId } = await call('CreateSceneItem', { sceneName, sourceName: name, sceneItemEnabled: true });
    item = { sceneItemId };
  }
  await call('SetSceneItemTransform', { sceneName, sceneItemId: item.sceneItemId, sceneItemTransform: layoutTransform(LAYOUTS[layout] ? layout : 'fill') });
  await keepOverlaysOnTop(sceneName);
  // Reopen the stream now (the source may have been idle).
  await call('TriggerMediaInputAction', { inputName: name, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART' }).catch(() => {});
}

function cameraSession(ws, holder, params) {
  const label = String(params.get('name') ?? '').replace(/[^\p{L}\p{N} ._-]+/gu, '').trim().slice(0, 40) || 'Camera';
  const source = `Camera · ${label}`;
  const sceneName = String(params.get('scene') ?? '');
  const layout = String(params.get('layout') ?? 'fill');
  let port = CAMERA_PORT_BASE;
  while (cameras.has(port)) port++;
  const vaapi = process.env.OBS_ENCODER !== 'x264';
  const video = vaapi
    ? ['-vaapi_device', VAAPI, '-vf', 'scale=w=1280:h=720:force_original_aspect_ratio=decrease,format=nv12,hwupload', '-c:v', 'h264_vaapi', '-b:v', '4M', '-bf', '0']
    : ['-vf', 'scale=w=1280:h=720:force_original_aspect_ratio=decrease', '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-b:v', '3M'];
  const ff = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'warning', '-fflags', '+genpts+nobuffer', '-i', 'pipe:0',
    ...video, '-g', '30', '-r', '30',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
    '-f', 'mpegts', '-flush_packets', '1', `udp://127.0.0.1:${port}?pkt_size=1316`,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  const cam = { source, since: Date.now(), bytes: 0, ff };
  cameras.set(port, cam);
  let errTail = '';
  ff.stderr.on('data', (c) => (errTail = (errTail + c).slice(-600)));
  ff.stdin.on('error', () => {});
  const done = openDoor(holder, 'camera', () => ws.close());
  let ended = false;
  const stop = (why) => {
    if (ended) return;
    ended = true;
    cameras.delete(port);
    done();
    try { ff.stdin.end(); } catch { /* gone */ }
    setTimeout(() => ff.kill('SIGKILL'), 2000);
    log(`camera ${source} stopped (${why}, ${cam.bytes} bytes)`);
  };
  ff.on('close', (code) => {
    if (!ended && code) ws.send({ type: 'error', message: `The encoder stopped: ${errTail.trim().split('\n').pop() ?? code}` });
    stop(`encoder exit ${code}`);
    ws.close();
  });
  // A browser that vanishes without closing (sleep, network loss) sends
  // nothing more; MediaRecorder sends every 250 ms, so 8 s of silence ends it.
  let lastData = Date.now();
  const idle = setInterval(() => {
    if (Date.now() - lastData > 8000) {
      clearInterval(idle);
      stop('no data for 8 s');
      ws.close();
    }
  }, 2000);
  ws.on('message', (msg) => {
    lastData = Date.now();
    cam.bytes += msg.length;
    if (!ff.stdin.destroyed) ff.stdin.write(msg);
  });
  ws.on('close', () => {
    clearInterval(idle);
    stop('closed');
  });
  cameraSource(source, port, sceneName, layout)
    .then(() => {
      log(`camera ${source} on port ${port} into "${sceneName}"`);
      ws.send({ type: 'ok', source, scene: sceneName });
    })
    .catch((e) => {
      ws.send({ type: 'error', message: e.message });
      ws.close();
    });
}

door.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url ?? '/', 'http://door');
  if (u.pathname === '/obs/camera/ws') {
    const camHolder = spendToken(u.searchParams.get('token'), 'camera');
    if (!camHolder) return void socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    return cameraSession(acceptWebSocket(req, socket, head), camHolder, u.searchParams);
  }
  const holder = u.pathname === '/obs/desktop/ws' ? spendToken(u.searchParams.get('token'), 'desktop') : null;
  if (!holder) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    return;
  }
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 5000);
  const up = connectTcp(VNC_WS_PORT, '127.0.0.1');
  up.setNoDelay(true);
  const done = openDoor(holder, 'desktop', () => {
    socket.destroy();
    up.destroy();
  });
  const end = () => {
    done();
    socket.destroy();
    up.destroy();
  };
  up.on('connect', () => {
    const lines = ['GET / HTTP/1.1'];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    up.write(lines.join('\r\n') + '\r\n\r\n');
    if (head?.length) up.write(head);
    socket.pipe(up);
    up.pipe(socket);
  });
  for (const s of [socket, up]) {
    s.on('close', end);
    s.on('error', end);
  }
});

door.listen(DOOR_PORT, '0.0.0.0', () => log(`door listening on ${DOOR_PORT}`));

connect();
