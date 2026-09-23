/**
 * Video pipelines: a Nextcloud folder you drop a recording into, and an edited
 * video that comes back out. Migration 147.
 *
 * THE FOLDER IS THE INTERFACE. The people who use this mostly never open the
 * site. They drop a meeting recording into "1 Drop recordings here" from the
 * Nextcloud app, and change the intro by replacing a file in "Intro and
 * outro". So each pipeline is a fixed tree under the org's storage root:
 *
 *   EAC_Network/<org>/Private/Video/<name>/
 *     1 Drop recordings here/   ← people put files here
 *     2 Processing/             ← the worker moved it here and is working
 *     3 Finished/               ← edited .mp4 + a thumbnail .jpg
 *     Originals/                ← the untouched recording, once rendered
 *     Failed/                   ← the original, when rendering failed
 *     Intro and outro/          ← intro.*, outro.*, background.* (optional)
 *     README.txt
 *
 * This file is the half any app may import: settings, folders, the job
 * table, and the scan that turns a dropped file into a queued job. The half
 * that runs ffmpeg is `./video-render` and is imported by the worker only —
 * it spawns processes and writes to local disk, which no web request should.
 *
 * NOT a security boundary: everything goes out over the service account.
 * Callers gate on org role first; every function here takes the org id and
 * scopes its SQL to it, so a job id from another org is simply not found.
 */

import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { davList, davMkcol, davMove, davPut, davGetText } from './dav';
import { orgStorageRoot, resolveOrgPath } from './org-storage';

// ---------------------------------------------------------------------------
// Folder layout
// ---------------------------------------------------------------------------

export const PIPELINE_FOLDERS = {
  drop: '1 Drop recordings here',
  processing: '2 Processing',
  finished: '3 Finished',
  originals: 'Originals',
  failed: 'Failed',
  assets: 'Intro and outro',
} as const;
export type PipelineFolderKey = keyof typeof PIPELINE_FOLDERS;

const VIDEO_EXT = /\.(mp4|m4v|mov|mkv|webm|avi|mpg|mpeg|ts|mts|wmv|flv|3gp)$/i;
const AUDIO_EXT = /\.(m4a|mp3|ogg|oga|opus|wav|flac|aac|weba)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

export type MediaKind = 'video' | 'audio' | 'image';

/** What a file is, by MIME first and extension second. Null: not ours. */
export function mediaKindOf(name: string, mime?: string | null): MediaKind | null {
  if (mime?.startsWith('video/')) return 'video';
  if (mime?.startsWith('audio/')) return 'audio';
  if (mime?.startsWith('image/') && IMAGE_EXT.test(name)) return 'image';
  if (VIDEO_EXT.test(name)) return 'video';
  if (AUDIO_EXT.test(name)) return 'audio';
  if (IMAGE_EXT.test(name)) return 'image';
  return null;
}

/** Files that are someone else's business: in-flight uploads, dotfiles, our README. */
function isIgnorable(name: string): boolean {
  return (
    name.startsWith('.') ||
    name.startsWith('~') ||
    /\.(part|crdownload|tmp)$/i.test(name) ||
    /\.ocTransferId\d+/i.test(name) ||
    name === 'README.txt'
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface PipelineSettings {
  /** Cut dead air (silence) off the start and end automatically. */
  trimSilence: boolean;
  /** Quieter than this counts as silence (dBFS). Meeting rooms sit around -50. */
  silenceDb: number;
  /** Shortest quiet stretch worth cutting, in seconds. */
  minSilenceSec: number;
  /** Seconds of the quiet kept either side of the cut, so speech isn't clipped. */
  trimPadSec: number;
  /** Even out the volume to YouTube's loudness (EBU R128, -16 LUFS). */
  loudnorm: boolean;
  /** Never upscale; cap the output height at this. */
  maxHeight: number;
  /** x264 quality, 18 (big, pristine) – 28 (small, soft). */
  crf: number;
  /** How long an intro/outro that is a still image stays on screen. */
  imageIntroSec: number;
}

export const DEFAULT_PIPELINE_SETTINGS: PipelineSettings = {
  trimSilence: true,
  silenceDb: -45,
  minSilenceSec: 4,
  trimPadSec: 1.5,
  loudnorm: true,
  maxHeight: 1080,
  crf: 21,
  imageIntroSec: 5,
};

function clamp(n: unknown, lo: number, hi: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

/** Stored settings are partial and untrusted; this is the only way to read them. */
export function normalizeSettings(raw: unknown): PipelineSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PIPELINE_SETTINGS;
  return {
    trimSilence: typeof r.trimSilence === 'boolean' ? r.trimSilence : d.trimSilence,
    silenceDb: clamp(r.silenceDb, -80, -10, d.silenceDb),
    minSilenceSec: clamp(r.minSilenceSec, 1, 120, d.minSilenceSec),
    trimPadSec: clamp(r.trimPadSec, 0, 10, d.trimPadSec),
    loudnorm: typeof r.loudnorm === 'boolean' ? r.loudnorm : d.loudnorm,
    maxHeight: [480, 720, 1080, 1440, 2160].includes(Number(r.maxHeight)) ? Number(r.maxHeight) : d.maxHeight,
    crf: Math.round(clamp(r.crf, 16, 32, d.crf)),
    imageIntroSec: clamp(r.imageIntroSec, 1, 30, d.imageIntroSec),
  };
}

// ---------------------------------------------------------------------------
// Pipelines
// ---------------------------------------------------------------------------

export interface VideoPipeline {
  id: string;
  orgId: string;
  slug: string;
  name: string;
  /** Relative to the org root; always under Private/ (see createVideoPipeline). */
  folder: string;
  settings: PipelineSettings;
  publishTarget: 'none' | 'youtube';
  enabled: boolean;
  lastScannedAt: string | null;
  createdAt: string;
}

export interface VideoPipelineSummary extends VideoPipeline {
  /** Full Nextcloud path of the pipeline root (for "open in Nextcloud"). */
  path: string;
  counts: Record<VideoJobStatus, number>;
}

function mapPipeline(r: any): VideoPipeline {
  return {
    id: r.id,
    orgId: r.org_id,
    slug: r.slug,
    name: r.name,
    folder: r.folder,
    settings: normalizeSettings(r.settings),
    publishTarget: r.publish_target,
    enabled: r.enabled,
    lastScannedAt: r.last_scanned_at ? new Date(r.last_scanned_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

/** Full Nextcloud path of one of a pipeline's folders. */
export function pipelinePath(p: Pick<VideoPipeline, 'orgId' | 'folder'>, key?: PipelineFolderKey): string {
  // Refuse outright rather than render into a folder /api/media would serve
  // to the public (see migration 148).
  if (!/^private\//i.test(p.folder)) throw new Error(`video pipeline folder must be under Private/: ${p.folder}`);
  const root = resolveOrgPath(p.orgId, p.folder);
  return key ? `${root}/${PIPELINE_FOLDERS[key]}` : root;
}

export async function listVideoPipelines(orgId: string): Promise<VideoPipelineSummary[]> {
  const rows = await db`
    SELECT p.*,
      COALESCE((SELECT jsonb_object_agg(status, n) FROM (
        SELECT status, COUNT(*)::int AS n FROM video_jobs j WHERE j.pipeline_id = p.id GROUP BY status
      ) c), '{}'::jsonb) AS counts
    FROM video_pipelines p
    WHERE p.org_id = ${orgId}
    ORDER BY p.created_at
  `;
  return rows.map((r: any) => {
    const p = mapPipeline(r);
    const counts = { queued: 0, processing: 0, ready: 0, approved: 0, published: 0, failed: 0, ...(r.counts ?? {}) };
    return { ...p, path: pipelinePath(p), counts };
  });
}

export async function listEnabledVideoPipelines(): Promise<VideoPipeline[]> {
  const rows = await db`SELECT * FROM video_pipelines WHERE enabled ORDER BY created_at`;
  return rows.map(mapPipeline);
}

export async function getVideoPipeline(orgId: string, id: string): Promise<VideoPipeline | null> {
  const [row] = await db`SELECT * FROM video_pipelines WHERE org_id = ${orgId} AND id = ${id}`;
  return row ? mapPipeline(row) : null;
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60) || 'pipeline';
}

/**
 * A new pipeline, named by a person ("Workshop sessions"). Its folder is
 * `Video/<name>` in the org's storage, created right away so the person can go
 * and drop something in it without waiting for the worker.
 */
export async function createVideoPipeline(
  orgId: string,
  name: string,
  createdBy: string | null
): Promise<{ ok: true; pipeline: VideoPipeline } | { ok: false; error: string }> {
  const clean = name.replace(/[/\\:*?"<>|\0]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!clean) return { ok: false, error: 'Give the pipeline a name.' };
  // Under Private/ so media-authz gates it to the org: an org path without a
  // Private segment is PUBLIC through every app's /api/media (migration 148).
  const folder = `Private/Video/${clean}`;
  const slug = slugify(clean);
  const [clash] = await db`
    SELECT 1 FROM video_pipelines WHERE org_id = ${orgId} AND (slug = ${slug} OR lower(folder) = lower(${folder}))
  `;
  if (clash) return { ok: false, error: 'There is already a pipeline with that name.' };

  const [row] = await db`
    INSERT INTO video_pipelines (id, org_id, slug, name, folder, created_by)
    VALUES (${nanoid(21)}, ${orgId}, ${slug}, ${clean}, ${folder}, ${createdBy})
    RETURNING *
  `;
  const pipeline = mapPipeline(row);
  await provisionPipelineFolders(pipeline);
  return { ok: true, pipeline };
}

export async function updateVideoPipeline(
  orgId: string,
  id: string,
  patch: { settings?: Partial<PipelineSettings>; enabled?: boolean }
): Promise<boolean> {
  const current = await getVideoPipeline(orgId, id);
  if (!current) return false;
  const settings = normalizeSettings({ ...current.settings, ...(patch.settings ?? {}) });
  const enabled = patch.enabled ?? current.enabled;
  await db`
    UPDATE video_pipelines SET settings = ${db.json(settings as never)}, enabled = ${enabled}
    WHERE org_id = ${orgId} AND id = ${id}
  `;
  return true;
}

const README = (p: VideoPipeline) => `${p.name}
${'='.repeat(p.name.length)}

Drop a recording into "${PIPELINE_FOLDERS.drop}" and the platform edits it for you:

  1. It moves to "${PIPELINE_FOLDERS.processing}" within a minute or two.
  2. Silence at the very start and end is cut off, the volume is evened out,
     and the intro and outro are joined on.
  3. The edited video (and a thumbnail) appears in "${PIPELINE_FOLDERS.finished}".
     Your original is kept, untouched, in "${PIPELINE_FOLDERS.originals}".

If something goes wrong the original goes to "${PIPELINE_FOLDERS.failed}" instead,
and the reason shows on the site under Manage → Video.

Intro and outro
---------------
Put files named intro.<something> and outro.<something> in "${PIPELINE_FOLDERS.assets}".
Each can be a video (mp4, mov...) or a still image (png, jpg), which is shown
for a few seconds. Replace a file to change it for every recording after that.
Leave the folder empty for no intro or outro.

For audio-only recordings, a picture named background.<png|jpg> is shown for
the whole recording (a plain black screen otherwise).

Video, audio (m4a, mp3, ogg...) and most recording formats are accepted.
`;

/** Create the tree and the README. Idempotent; cheap enough to run every start. */
export async function provisionPipelineFolders(p: VideoPipeline): Promise<boolean> {
  const root = pipelinePath(p);
  // MKCOL does not create parents, so walk down from the org root.
  const parts = p.folder.split('/').filter(Boolean);
  let path = orgStorageRoot(p.orgId);
  await davMkcol(path);
  for (const part of parts) {
    path = `${path}/${part}`;
    if (!(await davMkcol(path))) return false;
  }
  for (const key of Object.keys(PIPELINE_FOLDERS) as PipelineFolderKey[]) {
    await davMkcol(`${root}/${PIPELINE_FOLDERS[key]}`);
  }
  if ((await davGetText(`${root}/README.txt`)) === null) {
    await davPut(`${root}/README.txt`, new TextEncoder().encode(README(p)), 'text/plain; charset=utf-8');
  }
  return true;
}

export interface PipelineAsset {
  role: 'intro' | 'outro' | 'background';
  path: string;
  name: string;
  kind: MediaKind;
  size: number;
  lastModified: string | null;
}

/** intro.* / outro.* / background.* in the assets folder. First match by name wins. */
export async function listPipelineAssets(p: VideoPipeline): Promise<PipelineAsset[]> {
  const entries = await davList(pipelinePath(p, 'assets'));
  const out: PipelineAsset[] = [];
  for (const role of ['intro', 'outro', 'background'] as const) {
    const hit = entries.find((e) => {
      if (e.isFolder || isIgnorable(e.name)) return false;
      if (!e.name.toLowerCase().startsWith(role)) return false;
      const kind = mediaKindOf(e.name, e.mimeType);
      return role === 'background' ? kind === 'image' : kind === 'video' || kind === 'image';
    });
    if (hit) {
      out.push({
        role,
        path: hit.path,
        name: hit.name,
        kind: mediaKindOf(hit.name, hit.mimeType)!,
        size: hit.size,
        lastModified: hit.lastModified,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export type VideoJobStatus = 'queued' | 'processing' | 'ready' | 'approved' | 'published' | 'failed';

export interface VideoProbe {
  durationSec: number;
  width: number | null;
  height: number | null;
  fps: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface VideoAutoEdit {
  trimStart: number;
  trimEnd: number;
  /** Plain-language notes on what was decided and why. */
  reasons: string[];
  intro: string | null;
  outro: string | null;
  outDurationSec: number;
}

export interface VideoEditOverride {
  trimStart?: number;
  trimEnd?: number;
  skipIntro?: boolean;
  skipOutro?: boolean;
}

export interface VideoJob {
  id: string;
  pipelineId: string;
  orgId: string;
  sourceName: string;
  sourcePath: string;
  sourceBytes: number;
  status: VideoJobStatus;
  progress: number;
  probe: VideoProbe | null;
  autoEdit: VideoAutoEdit | null;
  editOverride: VideoEditOverride;
  title: string | null;
  description: string | null;
  threadId: string | null;
  outputPath: string | null;
  thumbnailPath: string | null;
  outputBytes: number | null;
  youtubeVideoId: string | null;
  error: string | null;
  attempts: number;
  heartbeatAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

function mapJob(r: any): VideoJob {
  return {
    id: r.id,
    pipelineId: r.pipeline_id,
    orgId: r.org_id,
    sourceName: r.source_name,
    sourcePath: r.source_path,
    sourceBytes: Number(r.source_bytes ?? 0),
    status: r.status,
    progress: Number(r.progress ?? 0),
    probe: r.probe ?? null,
    autoEdit: r.auto_edit ?? null,
    editOverride: r.edit_override ?? {},
    title: r.title,
    description: r.description,
    threadId: r.thread_id,
    outputPath: r.output_path,
    thumbnailPath: r.thumbnail_path,
    outputBytes: r.output_bytes == null ? null : Number(r.output_bytes),
    youtubeVideoId: r.youtube_video_id,
    error: r.error,
    attempts: r.attempts,
    heartbeatAt: iso(r.heartbeat_at),
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
    approvedAt: iso(r.approved_at),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function listVideoJobs(orgId: string, opts: { pipelineId?: string; limit?: number } = {}): Promise<VideoJob[]> {
  const limit = Math.min(200, opts.limit ?? 50);
  const rows = opts.pipelineId
    ? await db`SELECT * FROM video_jobs WHERE org_id = ${orgId} AND pipeline_id = ${opts.pipelineId} ORDER BY created_at DESC LIMIT ${limit}`
    : await db`SELECT * FROM video_jobs WHERE org_id = ${orgId} ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(mapJob);
}

export async function getVideoJob(orgId: string, id: string): Promise<VideoJob | null> {
  const [row] = await db`SELECT * FROM video_jobs WHERE org_id = ${orgId} AND id = ${id}`;
  return row ? mapJob(row) : null;
}

function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

/**
 * Remembers what each drop folder looked like on the previous scan. A file is
 * taken only once it has been seen twice with the same size and mtime — a
 * finished upload never changes, and Nextcloud clients upload in chunks to a
 * side folder then MOVE, so this is belt and braces rather than the only
 * guard. Lives in the worker's memory; a restart just costs one extra tick.
 */
export type DropSightings = Map<string, string>;

export interface ScanResult {
  pipelineId: string;
  queued: string[];
  waiting: string[];
  ignored: string[];
}

/**
 * Look in one pipeline's drop folder and turn every settled media file into a
 * queued job. The file is MOVED into "2 Processing" before the job row is
 * written, so a person watching the folder sees it taken, and a second scan
 * cannot find it again.
 */
export async function scanVideoPipeline(p: VideoPipeline, sightings: DropSightings): Promise<ScanResult> {
  const result: ScanResult = { pipelineId: p.id, queued: [], waiting: [], ignored: [] };
  const drop = pipelinePath(p, 'drop');
  const entries = await davList(drop);
  const seenNow = new Set<string>();

  for (const e of entries) {
    if (e.isFolder || isIgnorable(e.name)) continue;
    const kind = mediaKindOf(e.name, e.mimeType);
    if (kind !== 'video' && kind !== 'audio') {
      result.ignored.push(e.name);
      continue;
    }
    const key = `${p.id}:${e.name}`;
    const fingerprint = `${e.size}:${e.lastModified}`;
    seenNow.add(key);
    if (sightings.get(key) !== fingerprint || e.size === 0) {
      sightings.set(key, fingerprint);
      result.waiting.push(e.name);
      continue;
    }

    const id = nanoid(21);
    const processingPath = `${pipelinePath(p, 'processing')}/${id.slice(0, 6)} ${e.name}`;
    if (!(await davMove(e.path, processingPath))) continue; // retried next tick
    sightings.delete(key);
    try {
      await db`
        INSERT INTO video_jobs (id, pipeline_id, org_id, source_name, source_path, source_bytes, title)
        VALUES (${id}, ${p.id}, ${p.orgId}, ${e.name}, ${processingPath}, ${e.size}, ${titleFromFilename(e.name)})
      `;
      result.queued.push(e.name);
    } catch (err) {
      console.error('[video-pipeline] job insert failed, putting the file back:', err);
      await davMove(processingPath, e.path);
    }
  }

  // Forget files that left the folder (deleted, or moved by a person).
  for (const key of sightings.keys()) {
    if (key.startsWith(`${p.id}:`) && !seenNow.has(key)) sightings.delete(key);
  }
  await db`UPDATE video_pipelines SET last_scanned_at = NOW() WHERE id = ${p.id}`;
  return result;
}

// --- worker side ------------------------------------------------------------

/** Take the oldest queued job. SKIP LOCKED so a second worker would never share it. */
export async function claimNextVideoJob(): Promise<VideoJob | null> {
  const [row] = await db`
    UPDATE video_jobs SET status = 'processing', progress = 0, attempts = attempts + 1,
      started_at = NOW(), heartbeat_at = NOW(), updated_at = NOW(), error = NULL
    WHERE id = (
      SELECT j.id FROM video_jobs j JOIN video_pipelines p ON p.id = j.pipeline_id
      WHERE j.status = 'queued' AND p.enabled
      ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1
    )
    RETURNING *
  `;
  return row ? mapJob(row) : null;
}

/** A job left 'processing' by a worker that died goes back in the queue. */
export async function requeueStaleVideoJobs(staleAfterSec = 120): Promise<number> {
  const rows = await db`
    UPDATE video_jobs SET status = 'queued', progress = 0, updated_at = NOW()
    WHERE status = 'processing'
      AND (heartbeat_at IS NULL OR heartbeat_at < NOW() - make_interval(secs => ${staleAfterSec}))
    RETURNING id
  `;
  return rows.length;
}

export async function heartbeatVideoJob(id: string, progress: number, patch: { probe?: VideoProbe; autoEdit?: VideoAutoEdit } = {}): Promise<void> {
  await db`
    UPDATE video_jobs SET
      progress = ${Math.max(0, Math.min(1, progress))},
      heartbeat_at = NOW(), updated_at = NOW(),
      probe = COALESCE(${patch.probe ? db.json(patch.probe as never) : null}::jsonb, probe),
      auto_edit = COALESCE(${patch.autoEdit ? db.json(patch.autoEdit as never) : null}::jsonb, auto_edit)
    WHERE id = ${id} AND status = 'processing'
  `;
}

export async function finishVideoJob(
  id: string,
  out: { sourcePath: string; outputPath: string; thumbnailPath: string | null; outputBytes: number }
): Promise<void> {
  await db`
    UPDATE video_jobs SET status = 'ready', progress = 1, source_path = ${out.sourcePath},
      output_path = ${out.outputPath}, thumbnail_path = ${out.thumbnailPath}, output_bytes = ${out.outputBytes},
      finished_at = NOW(), updated_at = NOW(), heartbeat_at = NULL
    WHERE id = ${id}
  `;
}

export async function failVideoJob(id: string, error: string, sourcePath?: string): Promise<void> {
  await db`
    UPDATE video_jobs SET status = 'failed', error = ${error.slice(0, 4000)},
      source_path = COALESCE(${sourcePath ?? null}, source_path),
      finished_at = NOW(), updated_at = NOW(), heartbeat_at = NULL
    WHERE id = ${id}
  `;
}

// --- review side (apps) -----------------------------------------------------

/**
 * A person's corrections: title/description for publishing, and trim points
 * or intro/outro skips that beat the automatic edit. Changing the edit does
 * NOT re-render by itself — `requeueVideoJob` does, so someone can fix the
 * title without paying for another encode.
 */
export async function updateVideoJobReview(
  orgId: string,
  id: string,
  input: { title?: string; description?: string; override?: VideoEditOverride }
): Promise<boolean> {
  const job = await getVideoJob(orgId, id);
  if (!job) return false;
  const o = input.override;
  const override: VideoEditOverride = o
    ? {
        ...(Number.isFinite(o.trimStart) && o.trimStart! >= 0 ? { trimStart: o.trimStart } : {}),
        ...(Number.isFinite(o.trimEnd) && o.trimEnd! > 0 ? { trimEnd: o.trimEnd } : {}),
        ...(o.skipIntro ? { skipIntro: true } : {}),
        ...(o.skipOutro ? { skipOutro: true } : {}),
      }
    : job.editOverride;
  if (override.trimStart != null && override.trimEnd != null && override.trimEnd <= override.trimStart) return false;
  await db`
    UPDATE video_jobs SET
      title = ${input.title?.trim().slice(0, 100) ?? job.title},
      description = ${input.description?.trim().slice(0, 5000) ?? job.description},
      edit_override = ${db.json(override as never)}, updated_at = NOW()
    WHERE org_id = ${orgId} AND id = ${id}
  `;
  return true;
}

/** Render again (after a failure, or with new trims). Not while it is rendering. */
export async function requeueVideoJob(orgId: string, id: string): Promise<boolean> {
  const rows = await db`
    UPDATE video_jobs SET status = 'queued', progress = 0, error = NULL, updated_at = NOW(),
      approved_at = NULL, approved_by = NULL
    WHERE org_id = ${orgId} AND id = ${id} AND status IN ('ready', 'failed', 'approved')
    RETURNING id
  `;
  return rows.length > 0;
}

/** "This one can go out." Publishing itself waits for YouTube to exist. */
export async function approveVideoJob(orgId: string, id: string, userId: string): Promise<boolean> {
  const rows = await db`
    UPDATE video_jobs SET status = 'approved', approved_by = ${userId}, approved_at = NOW(), updated_at = NOW()
    WHERE org_id = ${orgId} AND id = ${id} AND status = 'ready'
    RETURNING id
  `;
  return rows.length > 0;
}
