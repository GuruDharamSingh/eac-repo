/**
 * Video recordings in a person's own files: chunked uploads while recording,
 * the list, rename and delete, and phone capture codes. Import as
 * `@elkdonis/services/recordings` from server code only.
 *
 *   users/<storage folder>/Private/Video/Recordings/   the Studio's Recordings kind, phone captures
 *   users/<storage folder>/Private/Video/Camera/       the broadcast console's Camera panel
 *   users/<storage folder>/Private/Video/Broadcasts/   booth (OBS) recordings copied out of the obs container
 *
 * Uploads use Nextcloud chunking v2 (dav.ts): parts of at least 5 MB except
 * the last, in order, then assembled. Upload ids and phone codes live in this
 * process's memory: a restart of the app forgets unfinished uploads (the
 * person records again) and unused codes.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { davChunkAbort, davChunkFinish, davChunkPut, davChunkStart, davDelete, davList, davMkcol, davMove, type DavEntry } from './dav';
import { getStorageSlug, userStorageRoot } from './user-storage';
import { archiveFileItem, ensureFileItem, moveFileItem } from './studio-items';

export type RecordingFolder = 'Recordings' | 'Camera' | 'Broadcasts';
const FOLDERS: RecordingFolder[] = ['Recordings', 'Camera', 'Broadcasts'];

async function folderPath(userId: string, folder: RecordingFolder): Promise<string> {
  const slug = await getStorageSlug(userId);
  if (!slug) throw new Error('Your storage folder is not set up yet');
  return `${userStorageRoot(slug)}/Private/Video/${folder}`;
}

const safeName = (name: string) =>
  name.replace(/[^\w.() ,'-]+/g, '-').replace(/^[.\s-]+/, '').replace(/\s+/g, ' ').slice(0, 100);
const VIDEO_EXT = /\.(webm|mp4|mov|m4v|mkv)$/i;

// ---------------------------------------------------------------------------
// Chunked uploads
// ---------------------------------------------------------------------------

interface Upload {
  userId: string;
  destination: string;
  next: number;
  started: number;
}
const uploads = new Map<string, Upload>();
const UPLOAD_TTL = 12 * 3600_000;

export async function recordingUploadStart(
  userId: string,
  fileName: string,
  folder: RecordingFolder = 'Recordings'
): Promise<{ id: string; path: string }> {
  for (const [id, u] of uploads) if (Date.now() - u.started > UPLOAD_TTL) uploads.delete(id);
  const name = safeName(fileName);
  if (!VIDEO_EXT.test(name)) throw new Error('Recordings are .webm, .mp4 or .mov');
  const dir = await folderPath(userId, folder);
  // MKCOL does not make parents; 405 means the folder is there.
  const parts = dir.split('/');
  for (let i = parts.length - 3; i <= parts.length; i++) await davMkcol(parts.slice(0, i).join('/'));
  const destination = `${dir}/${name}`;
  const id = `rec-${randomUUID()}`;
  await davChunkStart(id, destination);
  uploads.set(id, { userId, destination, next: 1, started: Date.now() });
  return { id, path: destination };
}

function ownUpload(userId: string, id: string): Upload {
  const u = uploads.get(id);
  if (!u || u.userId !== userId) throw new Error('No such upload');
  return u;
}

export async function recordingUploadPart(userId: string, id: string, index: number, body: ArrayBuffer): Promise<void> {
  const u = ownUpload(userId, id);
  if (index !== u.next) throw new Error(`Expected part ${u.next}, got ${index}`);
  await davChunkPut(id, index, body, u.destination);
  u.next++;
}

export async function recordingUploadFinish(userId: string, id: string): Promise<{ path: string }> {
  const u = ownUpload(userId, id);
  await davChunkFinish(id, u.destination);
  uploads.delete(id);
  // Lineage (studio-items.ts): best-effort, never throws.
  await ensureFileItem(userId, u.destination);
  return { path: u.destination };
}

export async function recordingUploadAbort(userId: string, id: string): Promise<void> {
  ownUpload(userId, id);
  uploads.delete(id);
  await davChunkAbort(id);
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

export interface Recording {
  name: string;
  path: string;
  size: number;
  modified: string | null;
  folder: RecordingFolder;
}

/** Newest first, from Recordings and the booth's Camera and Broadcasts folders. */
export async function listRecordings(userId: string): Promise<Recording[]> {
  const out: Recording[] = [];
  for (const folder of FOLDERS) {
    const entries: DavEntry[] = await davList(await folderPath(userId, folder));
    for (const e of entries) {
      if (e.isFolder || !VIDEO_EXT.test(e.name)) continue;
      out.push({ name: e.name, path: e.path, size: e.size, modified: e.lastModified, folder });
    }
  }
  return out.sort((a, b) => (b.modified ?? '').localeCompare(a.modified ?? ''));
}

/** The path must be one of this person's recordings (no other file). */
async function ownRecording(userId: string, path: string): Promise<{ dir: string; name: string }> {
  for (const folder of FOLDERS) {
    const dir = await folderPath(userId, folder);
    if (path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes('/') && !path.includes('..')) {
      return { dir, name: path.slice(dir.length + 1) };
    }
  }
  throw new Error('Not one of your recordings');
}

export async function renameRecording(userId: string, path: string, newName: string): Promise<{ path: string }> {
  const { dir, name } = await ownRecording(userId, path);
  const ext = name.match(VIDEO_EXT)?.[0] ?? '';
  const base = safeName(newName.replace(VIDEO_EXT, ''));
  if (!base) throw new Error('Give it a name');
  const to = `${dir}/${base}${ext}`;
  if (to === path) return { path };
  if (!(await davMove(path, to))) throw new Error('A recording with that name exists');
  await moveFileItem(userId, path, to);
  return { path: to };
}

export async function deleteRecording(userId: string, path: string): Promise<void> {
  await ownRecording(userId, path);
  if (!(await davDelete(path))) throw new Error('Could not delete it');
  await archiveFileItem(userId, path);
}

// ---------------------------------------------------------------------------
// Phone capture: the desktop asks for a code, the phone opens /c/<code>,
// records and uploads with the code as its only credential; the desktop
// polls until the file is there. A code lasts 30 minutes and is used once.
// ---------------------------------------------------------------------------

export type CaptureStatus = 'waiting' | 'recording' | 'uploading' | 'done' | 'failed';

interface Capture {
  code: string;
  userId: string;
  created: number;
  status: CaptureStatus;
  uploadId?: string;
  result?: { path: string; name: string; seconds: number | null };
  error?: string;
}
const captures = new Map<string, Capture>();
const CAPTURE_TTL = 30 * 60_000;
// No 0/O/1/I/L: read off one screen, typed on another.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function sweepCaptures() {
  for (const [code, c] of captures) if (Date.now() - c.created > CAPTURE_TTL && c.status !== 'uploading') captures.delete(code);
}

export function captureCreate(userId: string): { code: string; expiresAt: string } {
  sweepCaptures();
  // At most a few open codes per person.
  const mine = [...captures.values()].filter((c) => c.userId === userId && c.status !== 'done');
  for (const c of mine.slice(0, Math.max(0, mine.length - 4))) captures.delete(c.code);
  let code = '';
  do {
    const bytes = randomBytes(8);
    code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  } while (captures.has(code));
  const c: Capture = { code, userId, created: Date.now(), status: 'waiting' };
  captures.set(code, c);
  return { code, expiresAt: new Date(c.created + CAPTURE_TTL).toISOString() };
}

/** For the desktop that made the code: where the phone is. */
export function captureStatus(userId: string, code: string): { status: CaptureStatus; result?: Capture['result']; error?: string } | null {
  const c = captures.get(normalizeCode(code));
  if (!c || c.userId !== userId) return null;
  return { status: c.status, result: c.result, error: c.error };
}

export const normalizeCode = (code: string) => String(code ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');

function liveCapture(code: string): Capture {
  sweepCaptures();
  const c = captures.get(normalizeCode(code));
  if (!c || c.status === 'done' || Date.now() - c.created > CAPTURE_TTL) throw new Error('This code has expired. Make a new one on your computer.');
  return c;
}

/** The phone page: is the code usable? (Says nothing about whose it is.) */
export function captureValid(code: string): boolean {
  try {
    liveCapture(code);
    return true;
  } catch {
    return false;
  }
}

export function captureMark(code: string, status: 'recording' | 'failed', error?: string) {
  const c = liveCapture(code);
  c.status = status;
  c.error = error;
}

export async function captureUploadStart(code: string, ext: 'webm' | 'mp4'): Promise<void> {
  const c = liveCapture(code);
  if (c.uploadId) throw new Error('Already uploading');
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '');
  const { id } = await recordingUploadStart(c.userId, `Phone ${stamp}.${ext}`, 'Recordings');
  c.uploadId = id;
  c.status = 'uploading';
}

export async function captureUploadPart(code: string, index: number, body: ArrayBuffer): Promise<void> {
  const c = liveCapture(code);
  if (!c.uploadId) throw new Error('Start the upload first');
  await recordingUploadPart(c.userId, c.uploadId, index, body);
}

export async function captureUploadFinish(code: string, seconds: number | null): Promise<{ path: string }> {
  const c = liveCapture(code);
  if (!c.uploadId) throw new Error('Start the upload first');
  const { path } = await recordingUploadFinish(c.userId, c.uploadId);
  c.status = 'done';
  c.result = { path, name: path.split('/').pop() ?? path, seconds };
  return { path };
}
