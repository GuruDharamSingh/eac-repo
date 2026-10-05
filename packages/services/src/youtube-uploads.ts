/**
 * Recordings to YouTube — the queue (migration 193).
 *
 * A thread with `metadata.publish.youtube.connectionId` (publish-target.ts)
 * publishes the recordings filed under its folder:
 *
 *   <metadata.circle.folder>/Meeting Recordings/<session folder>/<file>
 *
 * The video worker calls scanYoutubeUploads() every minute: each settled
 * video file there becomes one video_uploads row, `queued` when the thread's
 * mode is 'auto' and the file is newer than the setting, else `awaiting` for
 * someone to approve. The worker then uploads queued rows
 * (youtube-uploader.ts, worker only: it needs the scratch disk).
 *
 * The functions an app calls (list, approve, skip, retry) take the org id and
 * thread id and scope their SQL to both. Callers gate on who may manage the
 * thread first.
 */

import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { listOrgFiles } from './org-storage';

export type VideoUploadStatus = 'awaiting' | 'queued' | 'uploading' | 'published' | 'failed' | 'skipped';

export interface VideoUpload {
  id: string;
  threadId: string | null;
  sourcePath: string;
  fileName: string;
  /** The session folder it was filed in, e.g. "2026-10-03 Day 1". */
  folder: string;
  sourceBytes: number;
  title: string;
  privacy: string;
  status: VideoUploadStatus;
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  uploadedBytes: number;
  error: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export const RECORDINGS_FOLDER = 'Meeting Recordings';
/** Talk writes .webm (video) or .ogg (audio only); YouTube needs a picture. */
const VIDEO_EXT = /\.(webm|mp4|mkv|mov|m4v)$/i;
/** A file still changing is not picked up (the filer moves settled files, but uploads by hand may be in flight). */
const SETTLE_MS = 3 * 60 * 1000;

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

function mapRow(r: any): VideoUpload {
  const parts = String(r.source_path).split('/');
  return {
    id: r.id,
    threadId: r.thread_id ?? null,
    sourcePath: r.source_path,
    fileName: parts[parts.length - 1] ?? r.source_path,
    folder: parts[parts.length - 2] ?? '',
    sourceBytes: Number(r.source_bytes ?? 0),
    title: r.title,
    privacy: r.privacy,
    status: r.status,
    youtubeVideoId: r.youtube_video_id ?? null,
    youtubeUrl: r.youtube_video_id ? `https://youtu.be/${r.youtube_video_id}` : null,
    uploadedBytes: Number(r.uploaded_bytes ?? 0),
    error: r.error ?? null,
    createdAt: iso(r.created_at)!,
    publishedAt: iso(r.published_at),
  };
}

// ── finding recordings ──────────────────────────────────────────────────────

interface PublishingThread {
  id: string;
  orgId: string;
  title: string;
  folder: string;
  connectionId: string;
  privacy: string;
  mode: 'auto' | 'review';
  setAt: Date | null;
}

async function listPublishingThreads(): Promise<PublishingThread[]> {
  const rows = await db`
    SELECT id, org_id, title, metadata
    FROM threads
    WHERE status = 'published'
      AND metadata->'publish'->'youtube'->>'connectionId' IS NOT NULL
      AND metadata->'circle'->>'folder' IS NOT NULL
  `;
  return rows.map((r: any) => {
    const y = r.metadata.publish.youtube;
    return {
      id: r.id,
      orgId: r.org_id,
      title: r.title,
      folder: String(r.metadata.circle.folder).replace(/\/+$/, ''),
      connectionId: y.connectionId,
      privacy: ['private', 'unlisted', 'public'].includes(y.privacy) ? y.privacy : 'private',
      mode: y.mode === 'auto' ? 'auto' : 'review',
      setAt: y.setAt ? new Date(y.setAt) : null,
    };
  });
}

/** "Akhand Path · 2026-10-03 Day 1" (+ " · part 2"), within YouTube's 100 characters. */
function titleFor(thread: string, folder: string, part: number): string {
  const t = `${thread} · ${folder}${part > 1 ? ` · part ${part}` : ''}`;
  return t.length > 100 ? `${t.slice(0, 99)}…` : t;
}

export interface UploadScanReport {
  threads: number;
  found: number;
  added: number;
}

/** Find new recordings under every publishing thread's folder; add a row for each. */
export async function scanYoutubeUploads(): Promise<UploadScanReport> {
  const report: UploadScanReport = { threads: 0, found: 0, added: 0 };
  for (const t of await listPublishingThreads()) {
    report.threads++;
    const root = `${t.folder}/${RECORDINGS_FOLDER}`;
    let sessions;
    try {
      sessions = (await listOrgFiles(t.orgId, root)).filter((e) => e.isFolder);
    } catch {
      continue;
    }
    for (const s of sessions) {
      const files = (await listOrgFiles(t.orgId, `${root}/${s.name}`).catch(() => []))
        .filter((f) => !f.isFolder && VIDEO_EXT.test(f.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      let part = 0;
      for (const f of files) {
        part++;
        report.found++;
        const modified = f.lastModified ? new Date(f.lastModified) : null;
        if (!modified || Date.now() - modified.getTime() < SETTLE_MS) continue;
        // Automatic only for what was recorded after the channel was chosen;
        // anything older waits for a person, so switching a circle to 'auto'
        // never sends its whole back catalogue at once.
        const auto = t.mode === 'auto' && (!t.setAt || modified >= t.setAt);
        const rows = await db`
          INSERT INTO video_uploads
            (id, org_id, thread_id, connection_id, source_path, source_bytes, source_modified, title, description, privacy, status)
          VALUES (
            ${nanoid(21)}, ${t.orgId}, ${t.id}, ${t.connectionId}, ${`${root}/${s.name}/${f.name}`},
            ${f.size}, ${modified}, ${titleFor(t.title, s.name, files.length > 1 ? part : 1)},
            ${`${t.title}, ${s.name}.`}, ${t.privacy}, ${auto ? 'queued' : 'awaiting'}
          )
          ON CONFLICT (org_id, source_path) DO NOTHING
          RETURNING id
        `;
        if (rows.length) report.added++;
      }
    }
  }
  return report;
}

// ── for the apps ────────────────────────────────────────────────────────────

export async function listThreadUploads(orgId: string, threadId: string, limit = 50): Promise<VideoUpload[]> {
  const rows = await db`
    SELECT * FROM video_uploads
    WHERE org_id = ${orgId} AND thread_id = ${threadId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapRow);
}

/**
 * approve: awaiting → queued (takes the thread's current channel and privacy)
 * retry:   failed → queued
 * skip:    awaiting/failed → skipped
 * restore: skipped → awaiting
 */
export async function actOnUpload(
  orgId: string,
  threadId: string,
  id: string,
  action: 'approve' | 'retry' | 'skip' | 'restore',
  userId: string
): Promise<boolean> {
  if (action === 'approve' || action === 'retry') {
    const [t] = await db`SELECT metadata FROM threads WHERE org_id = ${orgId} AND id = ${threadId}`;
    const y = t?.metadata?.publish?.youtube;
    if (!y?.connectionId) return false;
    const privacy = ['private', 'unlisted', 'public'].includes(y.privacy) ? y.privacy : 'private';
    const rows = await db`
      UPDATE video_uploads SET
        status = 'queued', error = NULL, connection_id = ${y.connectionId}, privacy = ${privacy},
        approved_by = COALESCE(approved_by, ${userId}), approved_at = COALESCE(approved_at, now()), updated_at = now()
      WHERE org_id = ${orgId} AND thread_id = ${threadId} AND id = ${id}
        AND status = ${action === 'approve' ? 'awaiting' : 'failed'}
      RETURNING id
    `;
    return rows.length > 0;
  }
  const rows = await db`
    UPDATE video_uploads SET status = ${action === 'skip' ? 'skipped' : 'awaiting'}, updated_at = now()
    WHERE org_id = ${orgId} AND thread_id = ${threadId} AND id = ${id}
      AND status = ANY(${action === 'skip' ? ['awaiting', 'failed'] : ['skipped']})
    RETURNING id
  `;
  return rows.length > 0;
}

// ── for the worker ──────────────────────────────────────────────────────────

export interface ClaimedUpload {
  id: string;
  orgId: string;
  connectionId: string | null;
  sourcePath: string;
  sourceBytes: number;
  title: string;
  description: string;
  privacy: string;
  uploadUrl: string | null;
  uploadedBytes: number;
}

export async function claimNextUpload(): Promise<ClaimedUpload | null> {
  const [r] = await db`
    UPDATE video_uploads SET status = 'uploading', attempts = attempts + 1, heartbeat_at = now(), updated_at = now()
    WHERE id = (
      SELECT id FROM video_uploads WHERE status = 'queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
  if (!r) return null;
  return {
    id: r.id,
    orgId: r.org_id,
    connectionId: r.connection_id,
    sourcePath: r.source_path,
    sourceBytes: Number(r.source_bytes),
    title: r.title,
    description: r.description,
    privacy: r.privacy,
    uploadUrl: r.upload_url,
    uploadedBytes: Number(r.uploaded_bytes),
  };
}

/** Anything 'uploading' whose heartbeat is older than `staleMs` goes back to the queue (resumes from upload_url). */
export async function requeueStaleUploads(staleMs: number): Promise<number> {
  const rows = await db`
    UPDATE video_uploads SET status = 'queued', updated_at = now()
    WHERE status = 'uploading' AND (heartbeat_at IS NULL OR heartbeat_at < now() - ${`${Math.round(staleMs / 1000)} seconds`}::interval)
    RETURNING id
  `;
  return rows.length;
}

export async function recordUploadProgress(id: string, fields: { uploadUrl?: string | null; uploadedBytes?: number }): Promise<void> {
  await db`
    UPDATE video_uploads SET
      upload_url = COALESCE(${fields.uploadUrl ?? null}, upload_url),
      uploaded_bytes = COALESCE(${fields.uploadedBytes ?? null}, uploaded_bytes),
      heartbeat_at = now(), updated_at = now()
    WHERE id = ${id}
  `;
}

export async function finishUpload(id: string, youtubeVideoId: string): Promise<void> {
  await db`
    UPDATE video_uploads SET status = 'published', youtube_video_id = ${youtubeVideoId}, error = NULL,
      upload_url = NULL, published_at = now(), updated_at = now()
    WHERE id = ${id}
  `;
}

/** `restart`: the resumable session is unusable; the next try starts from zero. */
export async function failUpload(id: string, error: string, restart = false): Promise<void> {
  await db`
    UPDATE video_uploads SET status = 'failed', error = ${error.slice(0, 1000)},
      ${restart ? db`upload_url = NULL, uploaded_bytes = 0,` : db``}
      updated_at = now()
    WHERE id = ${id}
  `;
}
