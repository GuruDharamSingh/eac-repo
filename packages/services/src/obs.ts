/**
 * Client for the server-side OBS agent (docker/obs/agent.mjs). Import as
 * `@elkdonis/services/obs` from server code only: it carries the agent
 * secret. There is one shared OBS instance; callers gate on users.is_admin.
 */

import { davList, resolveWithin } from './dav';
import { recordingUploadAbort, recordingUploadFinish, recordingUploadPart, recordingUploadStart } from './recordings';
import { getStorageSlug, userStorageRoot } from './user-storage';

const URL_ = (process.env.OBS_AGENT_URL ?? '').replace(/\/$/, '');
const SECRET = process.env.OBS_AGENT_SECRET ?? '';

export interface ObsStatus {
  connected: boolean;
  scenes?: string[];
  currentScene?: string;
  recording?: { active: boolean; paused: boolean; timecode: string; bytes: number };
  streaming?: { active: boolean; timecode: string; skipped: number };
  stats?: {
    cpu: number;
    memoryMb: number;
    fps: number;
    renderMs: number;
    renderSkipped: number;
    outputSkipped: number;
    outputTotal: number;
  };
  browserUrl?: string | null;
  /** The OGraf catalog and the layers on the "Overlays" source. */
  graphics?: ObsGraphics;
  /** Who has the studio open, if anyone. One session at a time. */
  lock?: { name: string; since: string } | null;
}

/** OGraf graphics on the "Overlays" source (docker/obs/agent.mjs "Graphics"). */
export interface ObsGraphics {
  catalog: {
    id: string;
    name: string;
    description: string;
    version: string | null;
    author: { name: string; url: string | null } | null;
    source: 'repo' | 'uploads';
    folder: string;
    schema: Record<string, unknown> | null;
    stepCount: number;
    customActions: { id: string; name: string; description: string; schema: unknown }[];
  }[];
  layers: { id: string; graphicId: string; data: Record<string, unknown>; playing: boolean; step: number }[];
}

/** `${userId}:${tabId}`: one browser tab of one person. */
export type ObsHolder = string;

export interface ObsRecording {
  name: string;
  size: number;
  modified: string;
  /** A background copy into someone's files (obsCopyRecording), while the agent runs. */
  copy?: {
    state: 'copying' | 'done' | 'failed';
    step: 'preparing' | 'converting' | 'sending' | null;
    sent: number;
    size: number;
    path: string;
    by: string;
    at: string;
    error: string | null;
  } | null;
}

export function obsConfigured(): boolean {
  return Boolean(URL_ && SECRET);
}

async function agent<T>(method: 'GET' | 'POST', path: string, body?: unknown, holder?: ObsHolder): Promise<T> {
  if (!obsConfigured()) throw new Error('OBS is not configured on this server');
  const headers: Record<string, string> = { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
  if (holder) headers['X-Holder'] = holder;
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(
      path.startsWith('/recordings/upload') || (path === '/studio' && method === 'POST') ? 600_000 : path === '/graphics/upload' ? 60_000 : 15_000
    ),
  } as Parameters<typeof fetch>[1]);
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `OBS agent ${res.status}`);
  return data as T;
}

export const obsStatus = () =>
  agent<ObsStatus>('GET', '/status').catch((): ObsStatus => ({ connected: false }));

/** The program output as a data URL, or null when OBS is not up. */
export async function obsScreenshot(holder: ObsHolder): Promise<string | null> {
  if (!obsConfigured()) return null;
  const res = await fetch(`${URL_}/screenshot`, {
    headers: { Authorization: `Bearer ${SECRET}`, 'X-Holder': holder },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  } as Parameters<typeof fetch>[1]).catch(() => null);
  if (!res?.ok) return null;
  return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

/** Claim or renew the one session. `held: false` carries who has it. */
export const obsClaim = (holder: ObsHolder, name: string) =>
  agent<{ held: boolean; lock: { name: string; since: string } | null }>('POST', '/lock', { holder, name });
export const obsRelease = (holder: ObsHolder) => agent('POST', '/unlock', { holder });

export const obsSetScene = (h: ObsHolder, name: string) => agent('POST', '/scene', { name }, h);
export const obsSetBrowserUrl = (h: ObsHolder, url: string) => agent('POST', '/browser', { url }, h);
export const obsRecord = (h: ObsHolder, action: 'start' | 'stop') => agent('POST', '/record', { action }, h);
export const obsStream = (h: ObsHolder, action: 'start' | 'stop') => agent('POST', '/stream', { action }, h);
export const obsStreamSettings = (h: ObsHolder, server: string, key: string) =>
  agent('POST', '/stream/settings', { server, key }, h);
/** Point OBS's stream at the relay's program path (docker/relay); the relay fans it out. */
export const obsStreamToRelay = (h: ObsHolder) => agent('POST', '/stream/relay', {}, h);
/** A relay feed (rtmp://relay:1935/in/<key>) as its own OBS scene. */
export const obsAddFeedScene = (h: ObsHolder, key: string, label: string) =>
  agent<{ scene: string }>('POST', '/feeds/add', { key, label }, h);
/** One command on the graphics layers (add, remove, play, stop, update, step, custom, move, clear). */
export const obsGraphicsCommand = (h: ObsHolder, cmd: Record<string, unknown>) => agent<ObsGraphics>('POST', '/graphics', cmd, h);
/** An admin's OGraf folder; `data` is base64. The agent checks names, types and size (25 MB). */
export const obsGraphicsUpload = (h: ObsHolder, folder: string, files: { path: string; data: string }[]) =>
  agent<ObsGraphics>('POST', '/graphics/upload', { folder, files }, h);
export const obsGraphicsDelete = (h: ObsHolder, folder: string) => agent<ObsGraphics>('POST', '/graphics/delete', { folder }, h);

/** What the booth page opens through the agent's door (docker/obs/agent.mjs). */
export type ObsDoor = 'desktop' | 'audio' | 'program' | 'levels' | 'camera';

/** A one-time token for one door connection: 60 s, bound to the lease holder. */
export const obsDoorToken = (h: ObsHolder, purpose: ObsDoor) =>
  agent<{ token: string; expiresInMs: number }>('POST', '/door/token', { purpose }, h);
export const obsRecordings = () => agent<ObsRecording[]>('GET', '/recordings').catch(() => [] as ObsRecording[]);
export const obsDeleteRecording = (h: ObsHolder, file: string) => agent('POST', '/recordings/delete', { file }, h);

/**
 * Copy a recording into the person's own storage as MP4:
 * users/<storage folder>/Private/Video/Broadcasts/<name>.mp4.
 */
export async function obsSaveRecording(h: ObsHolder, userId: string, file: string): Promise<{ path: string }> {
  return agent<{ path: string }>('POST', '/recordings/upload', { file, path: await broadcastsPath(userId, file) }, h);
}

/** Where a booth recording lands in the person's files: Private/Video/Broadcasts/<name>.mp4. */
async function broadcastsPath(userId: string, file: string): Promise<string> {
  const slug = await getStorageSlug(userId);
  if (!slug) throw new Error('Your storage folder is not set up yet');
  const name = file.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-') + '.mp4';
  return `${userStorageRoot(slug)}/Private/Video/Broadcasts/${name}`;
}

/**
 * The Studio's Recordings kind: copy a finished recording into the person's
 * files in the background (progress in obsRecordings()[].copy), without the
 * booth's lease, so it does not take the booth from whoever has it.
 */
export async function obsCopyRecording(userId: string, file: string, by: string) {
  return agent<NonNullable<ObsRecording['copy']>>('POST', '/recordings/copy', { file, path: await broadcastsPath(userId, file), by });
}
/** Delete a finished recording from the OBS container (refused while it is being written or copied). */
export const obsRemoveRecording = (file: string) => agent('POST', '/recordings/remove', { file });

// ---------------------------------------------------------------------------
// Studio: scenes, sources, layouts, transitions, audio (agent "Studio")
// ---------------------------------------------------------------------------

export interface ObsStudio {
  scenes: { name: string; items: { id: number; source: string; kind: string; enabled: boolean; builtIn: boolean }[] }[];
  program: string;
  preview: string | null;
  studioMode: boolean;
  transitions: string[];
  transition: string;
  transitionMs: number | null;
  audio: { name: string; kind: string; volumeDb: number; muted: boolean; monitor: boolean }[];
  layouts: string[];
}

export const obsStudio = () => agent<ObsStudio>('GET', '/studio');

/**
 * One editor command (scene.create, source.add, audio.volume, …; the agent's
 * studioCommand). A `path` (media and images) is relative to the person's own
 * storage folder and is resolved here, never taken whole from the client.
 */
export async function obsStudioCommand(h: ObsHolder, userId: string, cmd: Record<string, unknown>): Promise<ObsStudio> {
  const c: Record<string, unknown> = { ...cmd };
  if (typeof c.path === 'string') c.path = await obsMediaPath(userId, c.path);
  const settings = c.settings as Record<string, unknown> | undefined;
  if (settings && typeof settings.path === 'string') c.settings = { ...settings, path: await obsMediaPath(userId, settings.path) };
  return agent<ObsStudio>('POST', '/studio', c, h);
}

export const obsSourceSettings = (h: ObsHolder, name: string) => agent<Record<string, unknown>>('POST', '/studio/source', { name }, h);

async function obsMediaPath(userId: string, rel: string): Promise<string> {
  const slug = await getStorageSlug(userId);
  if (!slug) throw new Error('Your storage folder is not set up yet');
  return resolveWithin(userStorageRoot(slug), rel);
}

const MEDIA_KIND: Record<string, 'video' | 'audio' | 'image'> = {
  mp4: 'video', mov: 'video', mkv: 'video', webm: 'video', m4v: 'video', avi: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', oga: 'audio', opus: 'audio', m4a: 'audio', flac: 'audio', aac: 'audio',
  png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image',
};

export interface ObsMediaEntry {
  name: string;
  /** Relative to the person's storage folder. */
  path: string;
  isFolder: boolean;
  size: number;
  kind: 'video' | 'audio' | 'image' | null;
}

/** One folder of the person's own files, with only folders and media in it. */
export async function obsBrowseMedia(userId: string, rel = ''): Promise<ObsMediaEntry[]> {
  const slug = await getStorageSlug(userId);
  if (!slug) throw new Error('Your storage folder is not set up yet');
  const root = userStorageRoot(slug);
  const entries = await davList(resolveWithin(root, rel));
  const base = rel.replace(/^\/+|\/+$/g, '');
  return entries
    .map((e) => {
      const ext = e.name.split('.').pop()?.toLowerCase() ?? '';
      return { name: e.name, path: base ? `${base}/${e.name}` : e.name, isFolder: e.isFolder, size: e.size, kind: e.isFolder ? null : (MEDIA_KIND[ext] ?? null) };
    })
    .filter((e) => e.isFolder || e.kind)
    .sort((a, b) => (a.isFolder === b.isFolder ? a.name.localeCompare(b.name) : a.isFolder ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Camera recordings: the console's Camera panel records in the browser and
// sends the file in parts while it records, into Private/Video/Camera. The
// chunked upload itself is in ./recordings (shared with the Studio).
// ---------------------------------------------------------------------------

export const cameraUploadStart = (userId: string, fileName: string) => recordingUploadStart(userId, fileName, 'Camera');
export const cameraUploadPart = recordingUploadPart;
export const cameraUploadFinish = recordingUploadFinish;
export const cameraUploadAbort = recordingUploadAbort;
