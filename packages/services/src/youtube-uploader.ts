/**
 * Upload one queued recording to YouTube (migration 193). Worker only: runs
 * in eac-video-worker (scratch disk at VIDEO_WORK_DIR, Nextcloud access).
 * Not exported from the package index — it pulls in node:fs.
 *
 * YouTube's resumable protocol: POST the metadata to get a session URL, then
 * PUT the file in chunks (multiples of 256 KiB) with Content-Range; 308 means
 * "keep going" and its Range header says how much arrived; 200/201 carries
 * the video resource. The session URL is stored after every chunk, so an
 * interrupted upload (worker restart, network) resumes where it stopped
 * rather than sending gigabytes again. Sessions last about a week.
 *
 * Quota: an insert costs 1,600 of the project's default 10,000 units a day.
 * Unaudited Google projects get every API upload locked to private,
 * whatever privacyStatus asks for.
 */

import { mkdir, open, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { getConnectionAccessToken } from './connections';
import { resolveOrgPath } from './org-storage';
import { davDownloadToFile } from './video-render';
import {
  failUpload,
  finishUpload,
  recordUploadProgress,
  type ClaimedUpload,
} from './youtube-uploads';

const WORK = process.env.VIDEO_WORK_DIR || '/work';
const INIT_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
const CHUNK = 32 * 1024 * 1024; // 128 × 256 KiB
const TOKEN_MAX_AGE_MS = 40 * 60 * 1000; // access tokens live an hour

const MIME: Record<string, string> = {
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
};

type Log = (...a: unknown[]) => void;

class UploadError extends Error {
  constructor(message: string, readonly restart = false) {
    super(message);
  }
}

/** Google's error body, short. */
async function reason(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const j = JSON.parse(text);
    const e = j.error;
    const why = e?.errors?.[0]?.reason;
    return `${res.status} ${why ? `${why}: ` : ''}${e?.message ?? text.slice(0, 200)}`;
  } catch {
    return `${res.status} ${text.slice(0, 200)}`;
  }
}

/** The offset the server has, from a 308's `Range: bytes=0-N` (none = 0). */
function nextOffset(res: Response): number {
  const m = /bytes=0-(\d+)/.exec(res.headers.get('range') ?? '');
  return m ? Number(m[1]) + 1 : 0;
}

export async function processUpload(job: ClaimedUpload, log: Log): Promise<void> {
  const ext = path.extname(job.sourcePath).toLowerCase();
  const local = path.join(WORK, 'uploads', `${job.id}${ext}`);
  try {
    if (!job.connectionId) throw new UploadError('No YouTube connection: choose a channel in the circle’s settings.');

    // 1. The file, on local disk (kept between attempts if the size matches).
    await mkdir(path.dirname(local), { recursive: true });
    const have = await stat(local).then((s) => s.size).catch(() => -1);
    if (have !== job.sourceBytes || have <= 0) {
      log(`[upload] ${job.id}: downloading ${job.sourcePath}`);
      await davDownloadToFile(resolveOrgPath(job.orgId, job.sourcePath), local);
    }
    const size = (await stat(local)).size;
    if (size <= 0) throw new UploadError('The recording is empty.');

    // 2. An access token, refreshed as the upload goes on.
    let token = '';
    let tokenAt = 0;
    const auth = async (force = false) => {
      if (force || !token || Date.now() - tokenAt > TOKEN_MAX_AGE_MS) {
        const t = await getConnectionAccessToken(job.connectionId!);
        if (t.ok === false) throw new UploadError(t.error);
        token = t.accessToken;
        tokenAt = Date.now();
      }
      return `Bearer ${token}`;
    };

    // 3. A session: resume the stored one if YouTube still knows it.
    let session = job.uploadUrl;
    let offset = 0;
    if (session) {
      const res = await fetch(session, {
        method: 'PUT',
        headers: { Authorization: await auth(), 'Content-Length': '0', 'Content-Range': `bytes */${size}` },
      });
      if (res.status === 200 || res.status === 201) {
        const video = (await res.json()) as { id?: string };
        if (video.id) {
          await finishUpload(job.id, video.id);
          log(`[upload] ${job.id}: already complete → ${video.id}`);
          return;
        }
      } else if (res.status === 308) {
        offset = nextOffset(res);
        log(`[upload] ${job.id}: resuming at ${offset}/${size}`);
      } else {
        log(`[upload] ${job.id}: stored session gone (${res.status}); starting again`);
        session = null;
      }
    }
    if (!session) {
      const res = await fetch(INIT_URL, {
        method: 'POST',
        headers: {
          Authorization: await auth(),
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(size),
          'X-Upload-Content-Type': MIME[ext] ?? 'video/*',
        },
        body: JSON.stringify({
          snippet: { title: job.title, description: job.description },
          status: { privacyStatus: job.privacy, selfDeclaredMadeForKids: false },
        }),
      });
      if (!res.ok) throw new UploadError(`YouTube refused the upload: ${await reason(res)}`, true);
      session = res.headers.get('location');
      if (!session) throw new UploadError('YouTube returned no upload session.', true);
      offset = 0;
      await recordUploadProgress(job.id, { uploadUrl: session, uploadedBytes: 0 });
    }

    // 4. The chunks.
    const fh = await open(local, 'r');
    try {
      let serverErrors = 0;
      while (offset < size) {
        const end = Math.min(offset + CHUNK, size) - 1;
        const buf = Buffer.alloc(end - offset + 1);
        await fh.read(buf, 0, buf.length, offset);
        let res: Response;
        try {
          res = await fetch(session, {
            method: 'PUT',
            headers: {
              Authorization: await auth(),
              'Content-Length': String(buf.length),
              'Content-Range': `bytes ${offset}-${end}/${size}`,
            },
            body: buf,
          });
        } catch (err) {
          if (++serverErrors > 5) throw new UploadError(`Network error: ${(err as Error).message}`);
          await new Promise((r) => setTimeout(r, 2000 * serverErrors));
          continue;
        }
        if (res.status === 308) {
          offset = nextOffset(res);
          serverErrors = 0;
          await recordUploadProgress(job.id, { uploadedBytes: offset });
          continue;
        }
        if (res.status === 200 || res.status === 201) {
          const video = (await res.json()) as { id?: string };
          if (!video.id) throw new UploadError('YouTube finished without a video id.', true);
          await finishUpload(job.id, video.id);
          log(`[upload] ${job.id}: published → https://youtu.be/${video.id}`);
          await rm(local, { force: true });
          return;
        }
        if (res.status === 401) {
          await auth(true);
          continue;
        }
        if (res.status >= 500) {
          if (++serverErrors > 5) throw new UploadError(`YouTube kept failing: ${await reason(res)}`);
          await new Promise((r) => setTimeout(r, 2000 * serverErrors));
          continue;
        }
        if (res.status === 404 || res.status === 410) {
          throw new UploadError('The upload session expired; it will start again on retry.', true);
        }
        throw new UploadError(`YouTube refused a chunk: ${await reason(res)}`);
      }
    } finally {
      await fh.close();
    }
  } catch (err) {
    const e = err as Error;
    const restart = err instanceof UploadError ? err.restart : false;
    log(`[upload] ${job.id}: failed: ${e.message}`);
    await failUpload(job.id, e.message, restart);
  }
}
