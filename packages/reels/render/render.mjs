// Reel renderer. Runs in the reel-render container only
// (docker/reel-render.Dockerfile); the renderer is resolved from /opt/reel,
// not from the workspace, because the workspace holds musl builds.
//
//   --worker                 poll reel_renders (migration 189) and render each job
//   --project <nc path>      render a Nextcloud project folder (folder form)
//   --local <dir> [--out d]  render a local project folder
//   --init                   with --project/--local: create the folder layout
//
// Folder form layout (the Studio does not use it; it stores the edit in the
// database and names files by Nextcloud path):
//
//   <project>/
//     Logo/  1 Artwork/  2 Clip/  3 Second clip (optional)/
//     4 Something else (optional)/  Music (optional)/
//     reel.json   ← card text, colours, trims (optional)
//     Finished/   ← written here: <name>-<stamp>.mp4 + .jpg

import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const requireRenderer = createRequire('/opt/reel/package.json');
const { bundle } = requireRenderer('@remotion/bundler');
const { ensureBrowser, getVideoMetadata, renderMedia, renderStill, selectComposition } =
  requireRenderer('@remotion/renderer');

const ENTRY = resolve(import.meta.dirname, '../src/root.tsx');
const WORK_DIR = process.env.REEL_WORK_DIR || '/work';
const CONCURRENCY = Number(process.env.REEL_CONCURRENCY) || 4;
const FRAME_CACHE = (Number(process.env.REEL_FRAME_CACHE_MB) || 1024) * 1024 * 1024;
const POLL_MS = (Number(process.env.REEL_POLL_SECONDS) || 5) * 1000;

const SLOTS = {
  logo: 'Logo',
  artwork: '1 Artwork',
  clip: '2 Clip',
  clip2: '3 Second clip (optional)',
  extra: '4 Something else (optional)',
  music: 'Music (optional)',
};
const FINISHED = 'Finished';
// Network or personal music, and the network sound library: the only files a
// job may name outside its folder and the requester's own storage
// (packages/services/src/reels.ts checks the same at queue time).
const MUSIC_PATH = /^EAC_Network\/(oad|users\/[^/]+)\/Private\/Music\/[^/]+$/;
const SOUNDS_PATH = /^EAC_Network\/oad\/Private\/Sounds\/[^]+$/;
const IMAGE = /\.(png|jpe?g|webp|svg|gif)$/i;
const VIDEO = /\.(mp4|m4v|mov|webm|mkv)$/i;
const AUDIO = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i;
const ANY_MEDIA = new RegExp(`${IMAGE.source}|${VIDEO.source}`, 'i');
const slotPattern = (key) =>
  key === 'music' ? AUDIO : key === 'clip' || key === 'clip2' ? VIDEO : key === 'extra' ? ANY_MEDIA : IMAGE;

const SAMPLE_REEL_JSON = {
  template: 'artwork-reel',
  brand: { name: 'Org name', background: '#111111', foreground: '#f4f1ea' },
  endCard: { title: 'Artist name', subtitle: 'Title of the work', link: 'arts-collective.com' },
  clip: { trimStart: 0, voice: true },
  clip2: { trimStart: 0, voice: true },
  music: { volume: 0.7 },
};

// ---------------------------------------------------------------------------
// Nextcloud (WebDAV over the service account, as packages/services/src/dav.ts)
// ---------------------------------------------------------------------------

const NC_URL = process.env.NEXTCLOUD_URL ?? '';
const NC_USER = process.env.NEXTCLOUD_ADMIN_USER ?? '';
const NC_AUTH = `Basic ${Buffer.from(`${NC_USER}:${process.env.NEXTCLOUD_ADMIN_PASSWORD ?? ''}`).toString('base64')}`;

const encodePath = (p) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
const davUrl = (p) => `${NC_URL}/remote.php/dav/files/${encodeURIComponent(NC_USER)}/${encodePath(p)}`;

async function davList(path) {
  const res = await fetch(davUrl(path), { method: 'PROPFIND', headers: { Authorization: NC_AUTH, Depth: '1' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PROPFIND ${path}: ${res.status}`);
  const xml = await res.text();
  const hrefs = [...xml.matchAll(/<d:href>([^<]+)<\/d:href>/g)].map((m) => decodeURIComponent(m[1]));
  hrefs.shift(); // the folder itself
  return hrefs.map((h) => ({ name: basename(h.replace(/\/$/, '')), isFolder: h.endsWith('/') }));
}

async function davMkcol(path) {
  const res = await fetch(davUrl(path), { method: 'MKCOL', headers: { Authorization: NC_AUTH } });
  if (!res.ok && res.status !== 405) throw new Error(`MKCOL ${path}: ${res.status}`);
}

async function davDownload(path, dest) {
  const res = await fetch(davUrl(path), { headers: { Authorization: NC_AUTH } });
  if (!res.ok) throw new Error(`Could not read ${basename(path)} from storage (${res.status})`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function davUpload(path, src, type) {
  const res = await fetch(davUrl(path), {
    method: 'PUT',
    headers: { Authorization: NC_AUTH, 'Content-Type': type },
    body: await readFile(src),
  });
  if (!res.ok) throw new Error(`PUT ${path}: ${res.status}`);
}

// ---------------------------------------------------------------------------
// Local file server: Chrome and the compositor read slot files over HTTP.
// ---------------------------------------------------------------------------

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.mp4': 'video/mp4', '.m4v': 'video/mp4',
  '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.flac': 'audio/flac',
};

function serve(dir) {
  const server = createServer(async (req, res) => {
    const name = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '');
    if (!name || name.includes('/') || name.includes('..')) return res.writeHead(404).end();
    const path = join(dir, name);
    let size;
    try { size = (await stat(path)).size; } catch { return res.writeHead(404).end(); }
    const type = MIME[extname(name).toLowerCase()] ?? 'application/octet-stream';
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : size - 1;
      res.writeHead(206, {
        'Content-Type': type, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*',
        'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1,
      });
      return createReadStream(path, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' });
    createReadStream(path).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

let bundled = null;
async function getBundle() {
  // Bundle once per process: templates change rarely and a worker restart
  // picks up edits. Folder runs are one process per render anyway.
  if (!bundled) {
    await ensureBrowser();
    bundled = await bundle({
      entryPoint: ENTRY,
      // staticFile(): the clip template's FX (public/reel-fx, templates/fx-catalog.ts).
      publicDir: resolve(import.meta.dirname, '../public'),
      // One React and one Remotion: resolve from /opt/reel before anything
      // the repo's tree might offer.
      webpackOverride: (c) => ({
        ...c,
        resolve: { ...c.resolve, modules: ['/opt/reel/node_modules', 'node_modules'] },
      }),
    });
  }
  return bundled;
}

// Remotion's own ffmpeg (shipped with the compositor) has libx264 and the
// WebM decoders; no separate ffmpeg is installed in this image.
const COMPOSITOR_DIR = dirname(requireRenderer.resolve('@remotion/compositor-linux-x64-gnu/package.json'));

// Its filter set is small (trim, concat, scale, crop, loudnorm, silencedetect,
// no pad/overlay/eq), which bounds what the ffmpeg-only path below can do.

/** Run an ffmpeg (the compositor's by default); `onSeconds` gets the output time written so far. */
function ffmpeg(args, { onSeconds, bin = join(COMPOSITOR_DIR, 'ffmpeg') } = {}) {
  return new Promise((ok, fail) => {
    const progress = onSeconds ? ['-progress', 'pipe:1', '-nostats'] : [];
    const child = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...progress, ...args], {
      env: { ...process.env, LD_LIBRARY_PATH: COMPOSITOR_DIR },
      stdio: ['ignore', onSeconds ? 'pipe' : 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr.on('data', (c) => (err = (err + c).slice(-4000)));
    child.stdout?.on('data', (c) => {
      const m = /out_time_us=(\d+)\s*$/m.exec(String(c));
      if (m) onSeconds(Number(m[1]) / 1e6);
    });
    child.on('error', fail);
    child.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg: ${err.trim() || code}`))));
  });
}

/** Width and height of a picture or video's first video stream; null when ffprobe cannot read it. */
function probeSize(file) {
  return new Promise((ok) => {
    const child = spawn(join(COMPOSITOR_DIR, 'ffprobe'), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], {
      env: { ...process.env, LD_LIBRARY_PATH: COMPOSITOR_DIR },
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.on('error', () => ok(null));
    child.on('close', () => {
      const [w, h] = out.trim().split(',').map(Number);
      ok(w > 0 && h > 0 ? { width: w, height: h } : null);
    });
  });
}

/**
 * Pictures straight from a camera or phone are often 4000-8000 px; Chrome
 * decodes each at full size on every render tab. Scale PNG/JPEG pictures
 * down to `longest` px on the long edge before rendering (PNG stays PNG for
 * its transparency). Other formats (SVG, GIF, WebP) go through as they are.
 */
async function shrinkPictures(refs, jobDir, longest) {
  for (const ref of refs) {
    if (!ref?.path || !/\.(png|jpe?g)$/i.test(ref.path)) continue;
    const src = join(jobDir, ref.path);
    const size = await probeSize(src);
    if (!size || Math.max(size.width, size.height) <= longest) continue;
    const out = ref.path.replace(/(\.[^.]+)$/, `.s$1`);
    if (!existsSync(join(jobDir, out))) {
      const scale = `scale='min(${longest},iw)':'min(${longest},ih)':force_original_aspect_ratio=decrease`;
      await ffmpeg(['-i', src, '-vf', scale, ...(/\.png$/i.test(out) ? [] : ['-q:v', '2']), '-frames:v', '1', join(jobDir, out)]);
      console.log(`picture ${size.width}x${size.height} scaled to fit ${longest} px`);
    }
    ref.path = out;
  }
}

// --- Transcripts (reel_transcripts, migration 229) ---------------------------
// The image's own full ffmpeg (docker/reel-render.Dockerfile) extracts 16 kHz
// mono audio; whisper.cpp's full JSON (-ojf) gives its phrases and the
// tokens in them with times in ms. Tokens are joined into words (a token
// without a leading space continues the word before), the first word of each
// phrase marked `b: 1`. Words are stored in source seconds; the clip editor groups
// them into subtitle cues.

const FULL_FFMPEG = existsSync('/usr/local/bin/ffmpeg') ? '/usr/local/bin/ffmpeg' : null;
const WHISPER_CLI = '/usr/local/bin/whisper-cli';
const WHISPER_MODEL = process.env.REEL_WHISPER_MODEL || '/opt/whisper/ggml-small.en.bin';
const WHISPER_THREADS = Number(process.env.REEL_WHISPER_THREADS) || 6;

/** ffmpeg's log (stderr) for an analysis run that writes nothing. */
function ffmpegLog(args) {
  return new Promise((ok) => {
    const child = spawn(FULL_FFMPEG ?? join(COMPOSITOR_DIR, 'ffmpeg'), ['-hide_banner', '-nostats', ...args, '-f', 'null', '-'], {
      env: { ...process.env, LD_LIBRARY_PATH: COMPOSITOR_DIR },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let log = '';
    child.stderr.on('data', (c) => (log += c));
    child.on('error', () => ok(''));
    child.on('close', () => ok(log));
  });
}

/**
 * Silences in a WAV as [{ s, e }] seconds (ffmpeg silencedetect, 0.4 s or
 * longer). The threshold follows the recording: peak - 28 dB, kept within
 * -80..-30 dB. A fixed -35 dB took all of the 2026-11-01 Talk recording
 * (peak -42 dB) for silence; peak - 28 matched its word gaps.
 */
async function detectSilences(wav, total) {
  const peak = Number(/max_volume: (-?[\d.]+) dB/.exec(await ffmpegLog(['-i', wav, '-af', 'volumedetect']))?.[1]);
  const noise = Math.max(-80, Math.min(-30, Number.isFinite(peak) ? peak - 28 : -35));
  const log = await ffmpegLog(['-i', wav, '-af', `silencedetect=noise=${noise.toFixed(1)}dB:d=0.4`]);
  const out = [];
  let start = null;
  for (const m of log.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    if (m[1] === 'start') start = Math.max(0, Number(m[2]));
    else if (start !== null) {
      const e = Number(m[2]);
      const last = out[out.length - 1];
      // Silences a blip apart are one pause.
      if (last && start - last.e < 0.1) last.e = Number(e.toFixed(2));
      else out.push({ s: Number(start.toFixed(2)), e: Number(e.toFixed(2)) });
      start = null;
    }
  }
  // A silence running to the end of the file has no end line.
  if (start !== null && total) out.push({ s: Number(start.toFixed(2)), e: Number(total.toFixed(2)) });
  return out;
}

/**
 * The waveform (migration 232): one byte per 1/PEAK_RATE s, the loudest
 * sample in that span in dB under the recording's own peak, mapped
 * -PEAK_FLOOR..0 dB to 0..255. Relative to its own peak, so a quietly
 * recorded call (the booth's Talk audio, -42 dB peak) still draws.
 */
const PEAK_RATE = 20;
const PEAK_FLOOR = 48;
async function wavPeaks(wav) {
  const buf = await readFile(wav);
  // Walk the RIFF chunks to "data"; ffmpeg may write a LIST chunk first.
  let at = 12;
  let data = null;
  while (at + 8 <= buf.length) {
    const id = buf.toString('ascii', at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === 'data') {
      data = buf.subarray(at + 8, Math.min(buf.length, at + 8 + size));
      break;
    }
    at += 8 + size + (size & 1);
  }
  if (!data) return null;
  const per = 16000 / PEAK_RATE;
  const n = Math.ceil(data.length / 2 / per);
  const raw = new Float32Array(n);
  let top = 0;
  for (let i = 0; i < n; i++) {
    let m = 0;
    const end = Math.min(data.length / 2, (i + 1) * per);
    for (let k = i * per; k < end; k++) {
      const v = Math.abs(data.readInt16LE(k * 2));
      if (v > m) m = v;
    }
    raw[i] = m;
    if (m > top) top = m;
  }
  const out = Buffer.alloc(n);
  if (top > 0)
    for (let i = 0; i < n; i++) {
      const db = raw[i] > 0 ? 20 * Math.log10(raw[i] / top) : -PEAK_FLOOR;
      out[i] = Math.round(Math.max(0, Math.min(1, 1 + db / PEAK_FLOOR)) * 255);
    }
  return { rate: PEAK_RATE, data: out.toString('base64') };
}

/** Speech in a media file as words (and its silences); `onProgress` gets 0-1, `onPeaks` the waveform once the audio is out. */
async function transcribeFile(file, onProgress, total = 0, onPeaks) {
  if (!existsSync(WHISPER_CLI) || !existsSync(WHISPER_MODEL)) throw new Error('Speech-to-text is not installed in this renderer');
  const wav = `${file}.16k.wav`;
  const base = `${file}.words`;
  await ffmpeg(['-i', file, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], { bin: FULL_FFMPEG ?? undefined });
  const peaks = await wavPeaks(wav).catch((err) => {
    console.warn(`waveform: ${err?.message ?? err}`);
    return null;
  });
  if (peaks) await onPeaks?.(peaks);
  const pauses = await detectSilences(wav, total);
  onProgress?.(0.05);
  await new Promise((ok, fail) => {
    const child = spawn(WHISPER_CLI, ['-m', WHISPER_MODEL, '-f', wav, '-t', String(WHISPER_THREADS), '-ojf', '-of', base, '-pp', '-np'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr.on('data', (c) => {
      err = (err + c).slice(-4000);
      const m = /progress\s*=\s*(\d+)%/.exec(String(c));
      if (m) onProgress?.(0.05 + (Number(m[1]) / 100) * 0.95);
    });
    child.on('error', fail);
    child.on('close', (code) => (code === 0 ? ok() : fail(new Error(`whisper: ${err.trim().split('\n').slice(-3).join(' ') || code}`))));
  });
  const out = JSON.parse(await readFile(`${base}.json`, 'utf8'));
  await rm(wav, { force: true });
  await rm(`${base}.json`, { force: true });
  const words = [];
  for (const seg of out.transcription ?? []) {
    let first = true;
    for (const t of seg.tokens ?? []) {
      const text = String(t.text ?? '');
      // Special tokens: [_BEG_], [_TT_123], [BLANK_AUDIO] and the like.
      if (!text.trim() || /^\s*\[.*\]\s*$/.test(text)) continue;
      const s0 = (t.offsets?.from ?? 0) / 1000;
      const e0 = (t.offsets?.to ?? 0) / 1000;
      const last = words[words.length - 1];
      if (/^\s/.test(text) || !last || first) {
        words.push({ w: text.trim(), s: s0, e: Math.max(s0, e0), ...(first ? { b: 1 } : {}) });
        first = false;
      } else {
        last.w += text;
        last.e = Math.max(last.e, e0);
      }
    }
  }
  // Sound descriptions whisper writes in brackets, e.g. (music).
  return { words: words.filter((x) => !/^[[(].*[\])][.,]?$/.test(x.w)), pauses };
}

/** Take one queued transcript and do it. False when there was none (or the table is not there yet). */
let transcriptsMissingAt = 0;
async function takeTranscript(sql) {
  // Without migration 229 the table is missing: look again once a minute.
  if (Date.now() - transcriptsMissingAt < 60_000) return false;
  let job;
  try {
    [job] = await sql`
      UPDATE reel_transcripts SET status = 'running', started_at = now(), heartbeat_at = now(), progress = 0
      WHERE id = (
        SELECT id FROM reel_transcripts WHERE status = 'queued'
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
      )
      RETURNING *
    `;
  } catch (err) {
    if (err?.code === '42P01') {
      if (!transcriptsMissingAt) console.log('reel_transcripts is missing (migration 229 not applied); checking again every minute');
      transcriptsMissingAt = Date.now();
      return false;
    }
    throw err;
  }
  if (!job) return false;
  console.log(`transcript ${job.id} (project ${job.project_id})`);
  const jobDir = join(WORK_DIR, `tr-${job.id}`);
  try {
    await mkdir(jobDir, { recursive: true });
    const [who] = await sql`SELECT storage_folder FROM users WHERE id = ${job.requested_by}`;
    const ownRoot = who?.storage_folder ? `EAC_Network/users/${who.storage_folder}/` : null;
    if (job.path.includes('..') || !(job.path.startsWith(job.folder + '/') || (ownRoot && job.path.startsWith(ownRoot)))) {
      throw new Error(`Refusing a file outside the project: ${basename(job.path)}`);
    }
    const local = join(jobDir, `src${extname(job.path).toLowerCase()}`);
    await davDownload(job.path, local);
    const meta = await getVideoMetadata(local).catch(() => ({}));
    let lastWrite = 0;
    const t0 = Date.now();
    const { words, pauses } = await transcribeFile(local, (p) => {
      const now = Date.now();
      if (now - lastWrite < 2000) return;
      lastWrite = now;
      sql`UPDATE reel_transcripts SET progress = ${p}, heartbeat_at = now() WHERE id = ${job.id}`.catch(() => {});
    }, meta.durationInSeconds ?? 0, async (peaks) => {
      // Migration 232; without it there is no waveform, the rest goes on.
      await sql`UPDATE reel_transcripts SET peaks = ${sql.json(peaks)} WHERE id = ${job.id}`.catch((err) => {
        if (err?.code !== '42703') throw err;
      });
    });
    await sql`
      UPDATE reel_transcripts SET status = 'done', progress = 1, words = ${sql.json(words)},
        model = ${basename(WHISPER_MODEL)}, language = 'en', duration_s = ${meta.durationInSeconds ?? null}, finished_at = now()
      WHERE id = ${job.id}
    `;
    // Migration 231; without it the words are kept and the silences dropped.
    await sql`UPDATE reel_transcripts SET pauses = ${sql.json(pauses)} WHERE id = ${job.id}`.catch((err) => {
      if (err?.code !== '42703') throw err;
    });
    console.log(`transcript ${job.id} done: ${words.length} words, ${pauses.length} silences in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } catch (err) {
    console.error(`transcript ${job.id} failed:`, err);
    await sql`
      UPDATE reel_transcripts SET status = 'failed', error = ${String(err?.message ?? err).slice(0, 500)}, finished_at = now()
      WHERE id = ${job.id}
    `;
  } finally {
    await rm(jobDir, { recursive: true, force: true });
  }
  return true;
}

// --- ffmpeg-only path for the clip template --------------------------------
// The Studio's timeline writes one edit (cuts + overlays). When nothing in it
// needs Chrome, ffmpeg cuts and joins the parts itself, which is far quicker
// than Remotion screenshotting every frame. Subtitles and free text are
// written as an ASS file and burned in by libass (the image's ffmpeg 9);
// bars for "show the whole picture" use pad. The other overlays, the end
// card and a music bed go through Remotion. Keep the drawing rules in step
// with templates/clip.tsx (TextBox, Subtitles) and templates/subtitles.ts.

const CLIP_FPS = 30;
const CLIP_SIZE = { landscape: [1920, 1080], portrait: [1080, 1920], square: [1080, 1080] };

/** templates/clip.tsx clipSegments(), in plain JS. */
function clipSegmentsJs(clip) {
  const total = clip?.sourceSeconds > 0 ? clip.sourceSeconds : Infinity;
  const start = Math.max(0, Number(clip?.trimStart) || 0);
  const raw = clip?.segments?.length ? clip.segments : [{ from: start, to: start + Math.max(1, Number(clip?.duration) || 10) }];
  return raw
    .map((g) => ({ from: Math.max(0, Math.min(g.from, total)), to: Math.min(g.to, total) }))
    .filter((g) => g.to - g.from >= 0.1)
    .sort((a, b) => a.from - b.from);
}

/**
 * Even out a finished clip's sound for social platforms: EBU R128 loudnorm to
 * -16 LUFS, true peak -1.5 dB, video copied. The 2026-11-01 Talk recording
 * came out of the booth at -66 dB mean, -42 dB peak; unlevelled it is close
 * to silent on a phone. No-op for a file without sound.
 */
async function levelAudio(mp4, hasAudio) {
  if (!hasAudio) return false;
  const out = mp4.replace(/\.mp4$/, '.lv.mp4');
  await ffmpeg(['-i', mp4, '-map', '0', '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out], {
    bin: FULL_FFMPEG ?? undefined,
  });
  await rm(mp4);
  await writeFile(mp4, await readFile(out));
  await rm(out);
  return true;
}

/** Overlay kinds libass can draw like the template does. */
const ASS_KINDS = new Set(['text', 'subtitles']);
// Sound effects mix in with adelay + amix, which only the image's own ffmpeg has.
const MIX_KINDS = new Set(['sound']);

/** Null when the edit can go through ffmpeg alone, else the reason Remotion is needed. */
function needsRemotion(edit, source) {
  if (edit.template !== 'clip') return 'template';
  const o = edit.overlays ?? {};
  if (!o.items && (o.title?.text || o.lowerThird?.name || o.bug?.text)) return 'overlays';
  const items = o.items ?? [];
  if (items.length && !FULL_FFMPEG) return 'overlays';
  const other = items.find((i) => !ASS_KINDS.has(i?.kind) && !MIX_KINDS.has(i?.kind));
  if (other) return `overlays (${other.kind})`;
  if (edit.endCard?.title?.trim() || edit.endCard?.link?.trim()) return 'end card';
  if (edit.music?.path) return 'music';
  const [w, h] = CLIP_SIZE[edit.format ?? 'landscape'] ?? CLIP_SIZE.landscape;
  // Bars need pad, which only the image's own ffmpeg has.
  if (edit.fit === 'contain' && !FULL_FFMPEG && Math.abs(source.width / source.height - w / h) > 0.01) return 'bars';
  return null;
}

// --- Subtitles and text as ASS (libass) ---------------------------------------
// Sizes follow the template: letters = size% x 10.8 x u, u = short side / 1080;
// SANS/SERIF fall back to DejaVu in the renderer, so ASS names DejaVu too.

const ASS_FONTS = { sans: 'DejaVu Sans', serif: 'DejaVu Serif', mono: 'DejaVu Sans Mono' };
const FONTS_DIR = '/usr/share/fonts/truetype';
const HEX = /^#[0-9a-f]{6}$/i;
/** #rrggbb + opacity (0-1) → ASS &HAABBGGRR. */
function assColor(hex, opacity = 1) {
  const h = HEX.test(hex ?? '') ? hex.slice(1) : 'f3efe7';
  const a = Math.round((1 - opacity) * 255).toString(16).padStart(2, '0');
  return `&H${a}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase();
}
const assTime = (x) => {
  const cs = Math.max(0, Math.round(x * 100));
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};
// Braces start override tags and a backslash starts an escape in ASS text.
const assText = (t) => String(t ?? '').replace(/[{}]/g, (c) => (c === '{' ? '(' : ')')).replace(/\\/g, '\u29f5').replace(/\r?\n/g, '\\N');
const letters = (o, d) => Math.max(2, Math.min(20, Number(o.size) || d)) * 10.8;
// libass sizes a font by its ascent + descent, CSS by its em; DejaVu's are
// 2384/2048 em, so an ASS size of 1.164 x the CSS size gives the same letters.
const EM_TO_ASS = 2384 / 2048;

/**
 * The ASS file for an edit's text and subtitles, in the output's time.
 * `parts` are the kept parts with their exact lengths (as ffmpeg joins them).
 */
function editToAss(edit, parts, w, h) {
  const u = Math.min(w, h) / 1080;
  const total = parts.reduce((n, g) => n + (g.to - g.from), 0);
  const styles = [];
  const events = [];
  const BOX = (o) => assColor('#0c0a09', o);
  const NONE = '&HFF000000';
  (edit.overlays?.items ?? []).forEach((o, n) => {
    if (o.kind === 'subtitles' && o.cues?.length) {
      const size = letters(o, 4.2) * u * EM_TO_ASS;
      const top = o.place === 'top';
      // The template's line is at most 86% of the frame less 90 units each side.
      const side = Math.round((w - 0.86 * (w - 180 * u)) / 2);
      const base = assColor(o.color);
      const box = o.box !== false;
      const name = `S${n}`;
      // BorderStyle 4 (libass) = one box per event in BackColour, Outline = its
      // padding; the outline itself is made transparent. Style 3 boxes each
      // karaoke word, and the translucent boxes show seams where they overlap.
      styles.push(`Style: ${name},${ASS_FONTS[o.font] ?? ASS_FONTS.sans},${size.toFixed(1)},${base},${base},${box ? NONE : assColor('#000000', 0.85)},${box ? BOX(0.72) : assColor('#000000', 0.6)},${o.weight === 'bold' ? -1 : 0},0,0,0,100,100,0,0,${box ? 4 : 1},${box ? (0.3 * size).toFixed(1) : (2 * u).toFixed(1)},${box ? 0 : (2 * u).toFixed(1)},${top ? 8 : 2},${side},${side},${Math.round((top ? 70 : 84) * u + (box ? 0.3 * size : 0))},1`);
      const hi = o.highlight && HEX.test(o.highlight) ? o.highlight : null;
      for (const c of o.cues) {
        // Where the cue shows: its overlap with each kept part (TextFields.tsx cueOutput).
        let start = 0;
        for (const g of parts) {
          const a = Math.max(c.from, g.from);
          const b = Math.min(c.to, g.to);
          if (b - a > 0.05) {
            const from = start + a - g.from;
            const to = start + b - g.from;
            const words = hi && c.words?.length && c.words.map((x) => x.w).join(' ') === c.text ? c.words : null;
            let text;
            if (words) {
              // Karaoke: each word turns from the base colour (secondary) to the
              // highlight (primary) when it is spoken, as the template does.
              let at = 0;
              text = `{\\1c${assColor(hi)}\\2c${base}}`;
              words.forEach((wd, k) => {
                const ws = Math.max(0, wd.s - a);
                const next = k + 1 < words.length ? Math.max(ws, words[k + 1].s - a) : b - a;
                if (k === 0 && ws > 0) text += `{\\k${Math.round(ws * 100)}}`;
                text += `{\\k${Math.max(0, Math.round((next - Math.max(ws, at)) * 100))}}${assText(wd.w)}${k + 1 < words.length ? ' ' : ''}`;
                at = next;
              });
            } else text = assText(c.text);
            events.push(`Dialogue: 0,${assTime(from)},${assTime(to)},${name},,0,0,0,,${text}`);
          }
          start += g.to - g.from;
        }
      }
    } else if (o.kind === 'text' && o.text?.trim()) {
      const size = letters(o, 6) * u * EM_TO_ASS;
      const name = `T${n}`;
      const box = !!o.box;
      styles.push(`Style: ${name},${ASS_FONTS[o.font] ?? ASS_FONTS.sans},${size.toFixed(1)},${assColor(o.color)},${assColor(o.color)},${box ? NONE : assColor('#000000', 0.7)},${box ? BOX(0.78) : assColor('#000000', 0.5)},${o.weight === 'bold' ? -1 : 0},0,0,0,100,100,0,0,${box ? 4 : 1},${box ? (0.3 * size).toFixed(1) : (1.5 * u).toFixed(1)},${box ? 0 : (2 * u).toFixed(1)},5,0,0,0,1`);
      const at = Math.max(0, Number(o.at) || 0);
      if (at >= total) return;
      const end = Number(o.seconds) > 0 ? Math.min(total, at + Number(o.seconds)) : total;
      const x = (Math.max(0, Math.min(100, o.x ?? 50)) / 100) * w;
      const y = (Math.max(0, Math.min(100, o.y ?? 50)) / 100) * h;
      // 8 frames in and out, as the template's TextBox.
      events.push(`Dialogue: 1,${assTime(at)},${assTime(end)},${name},,0,0,0,,{\\an5\\pos(${x.toFixed(0)},${y.toFixed(0)})\\fad(267,267)}${assText(o.text)}`);
    }
  });
  if (!events.length) return null;
  return [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${w}`, `PlayResY: ${h}`, 'WrapStyle: 1', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ...styles, '',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events, '',
  ].join('\n');
}

/** Cut and join the kept parts with ffmpeg; same output size, rate and codecs as a Remotion render. */
async function renderCutsOnly({ edit, jobDir, source, mp4, jpg, onProgress }) {
  const src = join(jobDir, edit.clip.path);
  const parts = clipSegmentsJs(edit.clip);
  const [w, h] = CLIP_SIZE[edit.format ?? 'landscape'] ?? CLIP_SIZE.landscape;
  const total = parts.reduce((s, g) => s + (g.to - g.from), 0);
  // The template plays the clip's own sound whatever `voice` says (voice only
  // ducks a music bed, and there is none on this path).
  const audio = source.hasAudio;
  // One input per part: -ss before -i seeks each part directly instead of
  // decoding the whole source once per part.
  const inputs = parts.flatMap((g) => ['-ss', g.from.toFixed(3), '-t', (g.to - g.from).toFixed(3), '-i', src]);
  const streams = parts.map((_, i) => `[${i}:v:0]${audio ? `[${i}:a:0]` : ''}`).join('');
  // Bars (fit contain) need pad, which only the image's own ffmpeg has; needsRemotion() checked.
  const fit =
    edit.fit === 'contain' && FULL_FFMPEG
      ? `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${HEX.test(edit.brand?.background ?? '') ? edit.brand.background : '#111111'}`
      : `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
  const ass = editToAss(edit, parts, w, h);
  if (ass) await writeFile(join(jobDir, 'overlays.ass'), ass);
  const burn = ass ? `,ass=${join(jobDir, 'overlays.ass')}:fontsdir=${FONTS_DIR}` : '';
  let graph = `${streams}concat=n=${parts.length}:v=1:a=${audio ? 1 : 0}[cv]${audio ? '[a]' : ''};[cv]${fit}${burn}[v]`;
  // Sound effects: each from its own input, cut to its span, delayed to its
  // place, at its volume, then mixed over the clip's sound (or over silence
  // when the clip has none). normalize=0 keeps every level as set, as the
  // template does; `duration=first` ends the mix with the clip.
  const fx = (edit.overlays?.items ?? [])
    .filter((i) => i?.kind === 'sound' && i.sound?.path && (Number(i.at) || 0) < total)
    .map((i) => {
      const at = Math.max(0, Number(i.at) || 0);
      const len = Math.min(Number(i.seconds) > 0 ? Number(i.seconds) : total, total - at);
      return { file: join(jobDir, i.sound.path), at, len, volume: Math.max(0, Math.min(1.5, i.volume ?? 1)) };
    });
  const fxInputs = [];
  let base = audio ? '[a]' : null;
  if (fx.length) {
    let n = parts.length;
    if (!base) {
      fxInputs.push('-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');
      base = `[${n++}:a]`;
    }
    const labels = fx.map((f, k) => {
      fxInputs.push('-i', f.file);
      const ms = Math.round(f.at * 1000);
      graph += `;[${n++}:a:0]atrim=0:${f.len.toFixed(3)},aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}:all=1,volume=${f.volume.toFixed(2)}[s${k}]`;
      return `[s${k}]`;
    });
    graph += `;${base}aresample=48000,aformat=channel_layouts=stereo[b];[b]${labels.join('')}amix=inputs=${fx.length + 1}:normalize=0:duration=first[am]`;
  }
  const outAudio = fx.length ? '[am]' : audio ? '[a]' : null;
  await ffmpeg(
    [
      ...inputs,
      ...fxInputs,
      '-filter_complex', graph,
      '-map', '[v]', ...(outAudio ? ['-map', outAudio, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000'] : ['-an']),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(CLIP_FPS),
      '-movflags', '+faststart', mp4,
    ],
    { onSeconds: (s) => onProgress?.(Math.min(0.99, s / total)), bin: FULL_FFMPEG ?? undefined }
  );
  await ffmpeg(['-ss', String(Math.min(2, total / 2)), '-i', mp4, '-frames:v', '1', '-q:v', '3', jpg]);
  return { duration: total };
}

/**
 * Browser recordings (MediaRecorder WebM) carry no duration and no seek
 * index, so the compositor seeks them badly. Re-encode them to constant-rate
 * H.264 MP4 first. Other formats go through as they are.
 */
async function normalizeClips(edit, jobDir) {
  for (const key of ['clip', 'clip2', 'extra']) {
    const ref = edit[key];
    if (!ref?.path || !/\.(webm|mkv)$/i.test(ref.path)) continue;
    const out = ref.path.replace(/\.(webm|mkv)$/i, '.mp4');
    await ffmpeg([
      '-i', join(jobDir, ref.path),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
      join(jobDir, out),
    ]);
    await rm(join(jobDir, ref.path));
    ref.path = out;
  }
}

/** Fill each clip's available duration from the file, after its trim. */
async function probeClips(edit, localOf) {
  for (const key of ['clip', 'clip2', 'extra']) {
    const ref = edit[key];
    if (!ref?.path || (key === 'extra' && ref.kind !== 'video')) continue;
    const meta = await getVideoMetadata(localOf(ref.path));
    // A file with no readable duration keeps what the browser measured.
    const total = meta.durationInSeconds || Number(ref.duration) || 0;
    const available = Math.max(0.1, total - (Number(ref.trimStart) || 0));
    ref.duration = ref.duration ? Math.min(Number(ref.duration), available) : available;
    // The clip template clamps its cut list to the file (templates/clip.tsx).
    if (meta.durationInSeconds) ref.sourceSeconds = meta.durationInSeconds;
  }
}

function missing(edit) {
  // The clip template needs only its clip (templates/clip.tsx).
  if (edit.template === 'clip') return edit.clip?.path ? [] : ['clip'];
  const out = [];
  if (!edit.artwork?.path) out.push('artwork');
  if (!edit.clip?.path) out.push('clip');
  return out;
}

/**
 * Render an edit whose paths are file names inside `jobDir`. Returns the
 * local mp4/jpg and the duration.
 */
async function renderEdit({ edit, jobDir, name, fallbackName, onProgress }) {
  const need = missing(edit);
  if (need.length) throw new Error(`Empty slot: ${need.join(', ')}`);
  await normalizeClips(edit, jobDir);
  const server = await serve(jobDir);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const urls = {};
    for (const f of await readdir(jobDir)) urls[f] = `${base}/${encodeURIComponent(f)}`;
    await probeClips(edit, (p) => join(jobDir, p));
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const safe = (name || 'reel').replace(/[^\w.-]+/g, '-').slice(0, 60);
    const mp4 = join(jobDir, `${safe}-${stamp}.mp4`);
    const jpg = join(jobDir, `${safe}-${stamp}.jpg`);
    const t0 = Date.now();

    if (edit.template === 'clip' && process.env.REEL_FFMPEG_PATH !== 'off') {
      const meta = await getVideoMetadata(join(jobDir, edit.clip.path));
      const source = { width: meta.width, height: meta.height, hasAudio: !!meta.audioCodec };
      const why = needsRemotion(edit, source);
      if (!why) {
        const { duration } = await renderCutsOnly({ edit, jobDir, source, mp4, jpg, onProgress });
        if (edit.levelAudio !== false && (await levelAudio(mp4, source.hasAudio))) console.log('sound levelled to -16 LUFS');
        console.log(`ffmpeg path: ${duration.toFixed(1)} s of video in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        return { mp4, jpg, duration };
      }
      console.log(`Remotion path (${why})`);
    }

    // Pictures drawn in the frame: overlays and the logo at frame size; the
    // artwork card zooms in, so it keeps twice that.
    const long = Math.max(...(edit.template === 'clip' ? CLIP_SIZE[edit.format ?? 'landscape'] ?? CLIP_SIZE.landscape : [1920]));
    await shrinkPictures([edit.brand?.logo, ...(edit.overlays?.items ?? []).map((i) => (i?.kind === 'image' ? i.image : null))], jobDir, long);
    await shrinkPictures([edit.artwork, edit.extra?.kind === 'image' ? edit.extra : null], jobDir, long * 2);
    for (const f of await readdir(jobDir)) urls[f] ??= `${base}/${encodeURIComponent(f)}`;
    const inputProps = { edit, urls, fallbackName };

    const serveUrl = await getBundle();
    const composition = await selectComposition({ serveUrl, id: edit.template ?? 'artwork-reel', inputProps });
    const t1 = Date.now();
    await renderMedia({
      serveUrl, composition, inputProps,
      codec: 'h264', crf: 20, audioCodec: 'aac',
      outputLocation: mp4,
      concurrency: CONCURRENCY,
      chromiumOptions: { enableMultiProcessOnLinux: true },
      // The compositor's frame cache otherwise grows to the container's 6 GB
      // limit on a long 1080p source and the compositor is killed (2026-11-01).
      offthreadVideoCacheSizeInBytes: FRAME_CACHE,
      onProgress: ({ progress }) => onProgress?.(progress),
    });
    await renderStill({
      serveUrl, composition, inputProps, output: jpg, imageFormat: 'jpeg',
      frame: Math.min(composition.durationInFrames - 1, 60),
    });
    // A clip reel's sound is levelled like the ffmpeg path's (music included).
    if (edit.template === 'clip' && edit.levelAudio !== false && (await levelAudio(mp4, !!(await getVideoMetadata(mp4)).audioCodec))) {
      console.log('sound levelled to -16 LUFS');
    }
    const duration = composition.durationInFrames / composition.fps;
    console.log(`rendered ${duration.toFixed(1)} s of video in ${((Date.now() - t1) / 1000).toFixed(1)} s (${((Date.now() - t0) / 1000).toFixed(1)} s with bundling)`);
    return { mp4, jpg, duration };
  } finally {
    server.close();
  }
}

// ---------------------------------------------------------------------------
// Folder form
// ---------------------------------------------------------------------------

/** First matching file in a slot. Null: slot empty. */
const pick = (names, re) => names.filter((n) => re.test(n) && !n.startsWith('.')).sort()[0] ?? null;

/** Turn slot folders into an edit whose paths are local file names. */
async function folderEdit(listSlot, fetchInto, config, jobDir) {
  const edit = { template: 'artwork-reel', ...config };
  for (const [key, folder] of Object.entries(SLOTS)) {
    const name = pick(await listSlot(folder), slotPattern(key));
    if (!name) continue;
    const local = `${key}${extname(name).toLowerCase()}`;
    await fetchInto(`${folder}/${name}`, join(jobDir, local));
    const ref = { ...(config[key] ?? {}), path: local, name };
    if (key === 'logo') edit.brand = { ...(edit.brand ?? {}), logo: ref };
    else if (key === 'extra') edit.extra = { ...ref, kind: VIDEO.test(name) ? 'video' : 'image' };
    else edit[key] = ref;
  }
  // Overlay pictures and sounds named in reel.json, relative to the folder.
  let n = 0;
  for (const item of edit.overlays?.items ?? []) {
    const ref = item?.kind === 'image' ? item.image : item?.kind === 'sound' ? item.sound : null;
    if (!ref?.path || ref.path.includes('..')) continue;
    const local = `o${n++}${extname(ref.path).toLowerCase()}`;
    await fetchInto(ref.path, join(jobDir, local));
    ref.path = local;
  }
  return edit;
}

async function runFolder(args) {
  const jobDir = join(WORK_DIR, `job-${Date.now()}`);
  await mkdir(jobDir, { recursive: true });
  try {
    let edit;
    if (args.project) {
      const top = (await davList(args.project)) ?? [];
      let config = {};
      if (top.some((e) => e.name === 'reel.json')) {
        await davDownload(`${args.project}/reel.json`, join(jobDir, '.reel.json'));
        config = JSON.parse(await readFile(join(jobDir, '.reel.json'), 'utf8'));
        await rm(join(jobDir, '.reel.json'));
      }
      edit = await folderEdit(
        async (f) => ((await davList(`${args.project}/${f}`)) ?? []).filter((e) => !e.isFolder).map((e) => e.name),
        (rel, dest) => davDownload(`${args.project}/${rel}`, dest),
        config, jobDir
      );
    } else {
      const cfg = join(args.local, 'reel.json');
      const config = existsSync(cfg) ? JSON.parse(await readFile(cfg, 'utf8')) : {};
      edit = await folderEdit(
        async (f) => (existsSync(join(args.local, f)) ? readdir(join(args.local, f)) : []),
        async (rel, dest) => writeFile(dest, await readFile(join(args.local, rel))),
        config, jobDir
      );
    }
    const name = args.project ? basename(args.project) : basename(resolve(args.local));
    let last = -1;
    const out = await renderEdit({
      edit, jobDir, name,
      onProgress: (p) => {
        const pct = Math.floor(p * 10) * 10;
        if (pct !== last) process.stdout.write(`render ${(last = pct)}%\n`);
      },
    });
    if (args.project) {
      await davMkcol(`${args.project}/${FINISHED}`);
      await davUpload(`${args.project}/${FINISHED}/${basename(out.mp4)}`, out.mp4, 'video/mp4');
      await davUpload(`${args.project}/${FINISHED}/${basename(out.jpg)}`, out.jpg, 'image/jpeg');
      console.log(`uploaded to ${args.project}/${FINISHED}/${basename(out.mp4)}`);
    } else {
      const dir = args.out ?? join(args.local, FINISHED);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, basename(out.mp4)), await readFile(out.mp4));
      await writeFile(join(dir, basename(out.jpg)), await readFile(out.jpg));
      console.log(`written to ${join(dir, basename(out.mp4))}`);
    }
  } finally {
    await rm(jobDir, { recursive: true, force: true });
  }
}

async function initFolder(args) {
  if (args.project) {
    // Parents first: a fresh org has no Private/Video/Reels yet.
    const parts = args.project.split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i++) await davMkcol(parts.slice(0, i).join('/'));
    for (const f of [...Object.values(SLOTS), FINISHED]) await davMkcol(`${args.project}/${f}`);
    const tmp = join(WORK_DIR, `init-${Date.now()}.json`);
    await writeFile(tmp, JSON.stringify(SAMPLE_REEL_JSON, null, 2));
    await davUpload(`${args.project}/reel.json`, tmp, 'application/json');
    await rm(tmp);
  } else {
    for (const f of [...Object.values(SLOTS), FINISHED]) await mkdir(join(args.local, f), { recursive: true });
    await writeFile(join(args.local, 'reel.json'), JSON.stringify(SAMPLE_REEL_JSON, null, 2));
  }
  console.log('Project folders created.');
}

// ---------------------------------------------------------------------------
// Worker: the Studio's queue (reel_renders, migration 189)
// ---------------------------------------------------------------------------

async function runWorker() {
  const postgres = requireRenderer('postgres');
  const sql = postgres(process.env.DATABASE_URL, { max: 2, idle_timeout: 30 });

  // A job left 'running' by a previous process will never finish.
  const stale = await sql`
    UPDATE reel_renders SET status = 'failed', error = 'The renderer restarted during this render', finished_at = now()
    WHERE status = 'running' RETURNING id
  `;
  if (stale.length) console.log(`marked ${stale.length} interrupted render(s) failed`);
  await sql`
    UPDATE reel_transcripts SET status = 'failed', error = 'The renderer restarted during this transcript', finished_at = now()
    WHERE status = 'running'
  `.catch(() => {});
  console.log(`reel worker polling every ${POLL_MS / 1000}s`);

  for (;;) {
    const [job] = await sql`
      UPDATE reel_renders SET status = 'running', started_at = now(), heartbeat_at = now(), progress = 0
      WHERE id = (
        SELECT id FROM reel_renders WHERE status = 'queued'
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
      )
      RETURNING *
    `;
    if (!job) {
      // Renders first; a transcript only when no render waits.
      if (!(await takeTranscript(sql))) await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }
    console.log(`job ${job.id} (project ${job.project_id})`);
    const jobDir = join(WORK_DIR, `job-${job.id}`);
    try {
      await mkdir(jobDir, { recursive: true });
      // Download each named file under a short local name, and rewrite the
      // edit's paths to those names: the local server serves one flat folder.
      const edit = structuredClone(job.edit);
      let n = 0;
      const seen = new Map();
      // The requester's own storage is allowed too (files picked "From my
      // files"); services/reels.ts checked the same when the job was queued.
      const [who] = await sql`SELECT storage_folder FROM users WHERE id = ${job.requested_by}`;
      const ownRoot = who?.storage_folder ? `EAC_Network/users/${who.storage_folder}/` : null;
      const localize = async (ref) => {
        if (!ref?.path) return;
        if (ref.path.includes('..')) throw new Error('Refusing a path with ..');
        if (!ref.path.startsWith(job.folder + '/') && !MUSIC_PATH.test(ref.path) && !SOUNDS_PATH.test(ref.path) && !(ownRoot && ref.path.startsWith(ownRoot))) {
          throw new Error(`Refusing a file outside the project: ${basename(ref.path)}`);
        }
        if (!seen.has(ref.path)) {
          const local = `f${n++}${extname(ref.path).toLowerCase()}`;
          await davDownload(ref.path, join(jobDir, local));
          seen.set(ref.path, local);
        }
        ref.path = seen.get(ref.path);
      };
      await localize(edit.brand?.logo);
      for (const key of ['artwork', 'clip', 'clip2', 'extra', 'music']) await localize(edit[key]);
      // The clip template's picture overlays.
      for (const item of edit.overlays?.items ?? []) {
        if (item?.kind === 'image') await localize(item.image);
        else if (item?.kind === 'sound') await localize(item.sound);
      }

      let lastWrite = 0;
      const out = await renderEdit({
        edit, jobDir, name: edit.title || 'reel',
        onProgress: (p) => {
          const now = Date.now();
          if (now - lastWrite < 2000) return;
          lastWrite = now;
          sql`UPDATE reel_renders SET progress = ${p}, heartbeat_at = now() WHERE id = ${job.id}`.catch(() => {});
        },
      });
      const outPath = `${job.folder}/${FINISHED}/${basename(out.mp4)}`;
      const thumbPath = `${job.folder}/${FINISHED}/${basename(out.jpg)}`;
      await davMkcol(`${job.folder}/${FINISHED}`);
      await davUpload(outPath, out.mp4, 'video/mp4');
      await davUpload(thumbPath, out.jpg, 'image/jpeg');
      await sql`
        UPDATE reel_renders SET status = 'done', progress = 1, output_path = ${outPath},
          thumb_path = ${thumbPath}, duration_s = ${out.duration}, finished_at = now()
        WHERE id = ${job.id}
      `;
      console.log(`job ${job.id} done → ${outPath}`);
    } catch (err) {
      console.error(`job ${job.id} failed:`, err);
      await sql`
        UPDATE reel_renders SET status = 'failed', error = ${String(err?.message ?? err).slice(0, 500)}, finished_at = now()
        WHERE id = ${job.id}
      `;
    } finally {
      await rm(jobDir, { recursive: true, force: true });
    }
  }
}

// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    worker: { type: 'boolean', default: false },
    project: { type: 'string' },
    local: { type: 'string' },
    out: { type: 'string' },
    init: { type: 'boolean', default: false },
    transcribe: { type: 'string' },
  },
});

if (args.worker) await runWorker();
else if (args.transcribe) {
  // A local file's words as JSON on stdout (testing the speech-to-text install).
  const t0 = Date.now();
  let peaks = null;
  const { words, pauses } = await transcribeFile(resolve(args.transcribe), (p) => process.stderr.write(`transcribe ${Math.round(p * 100)}%\r`), 0, (p) => {
    peaks = p;
    console.error(`waveform after ${((Date.now() - t0) / 1000).toFixed(1)} s: ${Buffer.from(p.data, 'base64').length} values`);
  });
  console.error(`\n${words.length} words, ${pauses.length} silences in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(JSON.stringify({ words, pauses, peaks }));
} else if (!args.project && !args.local) {
  console.error('Usage: --worker | --project <nextcloud path> | --local <dir> [--out <dir>] [--init] | --transcribe <file>');
  process.exit(2);
} else await (args.init ? initFolder(args) : runFolder(args));
