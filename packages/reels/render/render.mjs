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
// Network or personal music: the only files a job may name outside its folder
// (packages/services/src/reels.ts checks the same at queue time).
const MUSIC_PATH = /^EAC_Network\/(oad|users\/[^/]+)\/Private\/Music\/[^/]+$/;
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

function ffmpeg(args) {
  return new Promise((ok, fail) => {
    const child = spawn(join(COMPOSITOR_DIR, 'ffmpeg'), ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      env: { ...process.env, LD_LIBRARY_PATH: COMPOSITOR_DIR },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr.on('data', (c) => (err = (err + c).slice(-4000)));
    child.on('error', fail);
    child.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg: ${err.trim() || code}`))));
  });
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
  }
}

function missing(edit) {
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
    const inputProps = { edit, urls, fallbackName };

    const serveUrl = await getBundle();
    const composition = await selectComposition({ serveUrl, id: edit.template ?? 'artwork-reel', inputProps });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const safe = (name || 'reel').replace(/[^\w.-]+/g, '-').slice(0, 60);
    const mp4 = join(jobDir, `${safe}-${stamp}.mp4`);
    const jpg = join(jobDir, `${safe}-${stamp}.jpg`);
    const t0 = Date.now();
    await renderMedia({
      serveUrl, composition, inputProps,
      codec: 'h264', crf: 20, audioCodec: 'aac',
      outputLocation: mp4,
      concurrency: CONCURRENCY,
      chromiumOptions: { enableMultiProcessOnLinux: true },
      onProgress: ({ progress }) => onProgress?.(progress),
    });
    await renderStill({
      serveUrl, composition, inputProps, output: jpg, imageFormat: 'jpeg',
      frame: Math.min(composition.durationInFrames - 1, 60),
    });
    const duration = composition.durationInFrames / composition.fps;
    console.log(`rendered ${duration.toFixed(1)} s of video in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
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
      await new Promise((r) => setTimeout(r, POLL_MS));
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
        if (!ref.path.startsWith(job.folder + '/') && !MUSIC_PATH.test(ref.path) && !(ownRoot && ref.path.startsWith(ownRoot))) {
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
  },
});

if (args.worker) await runWorker();
else if (!args.project && !args.local) {
  console.error('Usage: --worker | --project <nextcloud path> | --local <dir> [--out <dir>] [--init]');
  process.exit(2);
} else await (args.init ? initFolder(args) : runFolder(args));
