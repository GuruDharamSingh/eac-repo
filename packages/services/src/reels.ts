/**
 * Reels: Studio video projects (migration 189). Templates and rendering are
 * `packages/reels`; this file is the data and storage side any app may import
 * as `@elkdonis/services/reels`.
 *
 * Nextcloud holds every file; the database keeps the edit description and
 * the render queue.
 *   project:        <owner root>/Private/Video/Reels/<id>/   (uploads + Finished/)
 *   personal music: EAC_Network/users/<storage slug>/Private/Music/
 *   network music:  EAC_Network/oad/Private/Music/   (`oad` is the network's own
 *                   org, the collective's artists; its members read it through
 *                   the ordinary org rule in media-authz.ts)
 *   sound effects:  EAC_Network/oad/Private/Sounds/<Category>/ and
 *                   <own>/Private/Sounds/, credited in each folder's sounds.json
 * A "Just me" project (org `oad`) lives in the person's own storage; an org
 * project in the org's. Every function takes the acting user and checks
 * ownership itself: callers are server actions and routes, and a project id
 * from another account is simply not found.
 */

import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { davAuthHeader, davGetText, davList, davListDeep, davMkcol, davPut, davUrl, type DavEntry } from './dav';
import { orgStorageRoot } from './org-storage';
import { getStorageSlug, userStorageRoot } from './user-storage';
import { archiveReelItem, ensureReelItem, linkReelPublished, syncReelSources } from './studio-items';

const PERSONAL_ORG_ID = 'oad';
const ROOT = process.env.NEXTCLOUD_ORG_ROOT_FOLDER || 'EAC_Network';
export const NETWORK_MUSIC_FOLDER = `${ROOT}/${PERSONAL_ORG_ID}/Private/Music`;

export type ReelSlot = 'logo' | 'artwork' | 'clip' | 'clip2' | 'extra' | 'music' | 'sound';
export const REEL_SLOTS: ReelSlot[] = ['logo', 'artwork', 'clip', 'clip2', 'extra', 'music', 'sound'];

export interface ReelProject {
  id: string;
  orgId: string;
  ownerId: string;
  title: string;
  template: string;
  edit: Record<string, unknown>;
  folder: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReelRender {
  id: string;
  projectId: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  outputPath: string | null;
  thumbPath: string | null;
  durationS: number | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

interface ProjectRow {
  id: string;
  org_id: string;
  owner_id: string;
  title: string;
  template: string;
  edit: Record<string, unknown>;
  folder: string;
  created_at: Date;
  updated_at: Date;
}

const toProject = (r: ProjectRow): ReelProject => ({
  id: r.id,
  orgId: r.org_id,
  ownerId: r.owner_id,
  title: r.title,
  template: r.template,
  edit: r.edit ?? {},
  folder: r.folder,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

interface RenderRow {
  id: string;
  project_id: string;
  status: ReelRender['status'];
  progress: number;
  output_path: string | null;
  thumb_path: string | null;
  duration_s: number | null;
  error: string | null;
  created_at: Date;
  finished_at: Date | null;
}

const toRender = (r: RenderRow): ReelRender => ({
  id: r.id,
  projectId: r.project_id,
  status: r.status,
  progress: r.progress,
  outputPath: r.output_path,
  thumbPath: r.thumb_path,
  durationS: r.duration_s,
  error: r.error,
  createdAt: r.created_at.toISOString(),
  finishedAt: r.finished_at?.toISOString() ?? null,
});

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

/** MKCOL every folder of `path` that is missing. MKCOL is not recursive. */
async function mkdirs(path: string): Promise<boolean> {
  const parts = path.split('/').filter(Boolean);
  for (let i = 1; i <= parts.length; i++) {
    if (!(await davMkcol(parts.slice(0, i).join('/')))) return false;
  }
  return true;
}

/**
 * PUT a request body straight through to Nextcloud. Phone video runs to
 * hundreds of megabytes; buffering it in the app container is what this avoids.
 */
export async function davPutStream(
  path: string,
  body: ReadableStream<Uint8Array>,
  contentType: string,
  contentLength?: string | null
): Promise<boolean> {
  const headers: Record<string, string> = { Authorization: davAuthHeader(), 'Content-Type': contentType };
  if (contentLength) headers['Content-Length'] = contentLength;
  const init = { method: 'PUT', headers, body, duplex: 'half' } as unknown as Parameters<typeof fetch>[1];
  const res = await fetch(davUrl(path), init);
  if (!res.ok) console.error(`[reels] PUT ${path} -> ${res.status}`);
  return res.ok;
}

async function davCopy(from: string, to: string): Promise<boolean> {
  const res = await fetch(davUrl(from), {
    method: 'COPY',
    headers: { Authorization: davAuthHeader(), Destination: davUrl(to), Overwrite: 'F' },
  });
  return res.ok;
}

function safeName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9.\-_ ]/g, '_').replace(/^\.+/, '').slice(-120);
  return clean || 'file';
}

async function personalRoot(userId: string): Promise<string | null> {
  const slug = await getStorageSlug(userId);
  return slug ? userStorageRoot(slug) : null;
}

/** May this person make reels as this org? `oad` is "Just me", open to all. */
async function canActFor(userId: string, orgId: string): Promise<boolean> {
  if (orgId === PERSONAL_ORG_ID) return true;
  const rows = await db<Array<{ ok: number }>>`
    SELECT 1 AS ok FROM user_organizations
    WHERE user_id = ${userId} AND org_id = ${orgId}
      AND role IN ('owner', 'guide', 'member')
    LIMIT 1
  `;
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createReelProject(
  userId: string,
  orgId: string,
  template: string,
  title?: string
): Promise<{ ok: boolean; project?: ReelProject; error?: string }> {
  if (!(await canActFor(userId, orgId))) return { ok: false, error: 'Not a member of that organisation' };
  const id = nanoid(12);
  const base = orgId === PERSONAL_ORG_ID ? await personalRoot(userId) : orgStorageRoot(orgId);
  if (!base) return { ok: false, error: 'Your storage folder is not set up yet' };
  const folder = `${base}/Private/Video/Reels/${id}`;
  if (!(await mkdirs(`${folder}/Finished`))) return { ok: false, error: 'Could not create the project folder' };
  const rows = await db<ProjectRow[]>`
    INSERT INTO reel_projects (id, org_id, owner_id, title, template, edit, folder)
    VALUES (${id}, ${orgId}, ${userId}, ${title?.trim() || 'Untitled reel'}, ${template},
            ${db.json({ template } as never)}, ${folder})
    RETURNING *
  `;
  const project = toProject(rows[0]);
  await ensureReelItem(project);
  return { ok: true, project };
}

export async function listReelProjects(userId: string): Promise<ReelProject[]> {
  const rows = await db<ProjectRow[]>`
    SELECT * FROM reel_projects
    WHERE owner_id = ${userId} AND archived_at IS NULL
    ORDER BY updated_at DESC LIMIT 200
  `;
  return rows.map(toProject);
}

export async function getReelProject(userId: string, id: string): Promise<ReelProject | null> {
  const rows = await db<ProjectRow[]>`
    SELECT * FROM reel_projects WHERE id = ${id} AND owner_id = ${userId} AND archived_at IS NULL
  `;
  return rows[0] ? toProject(rows[0]) : null;
}

/**
 * Every Nextcloud path in an edit must be one this project may use: its own
 * folder, anything in the person's own storage (their files, other reels'
 * finished videos, broadcasts: the "From my files" picker), or the network
 * music folder. Without this check an edit could name another org's private
 * file and the renderer (which reads with the service account) would fetch it.
 */
async function pathsAllowed(userId: string, project: ReelProject, edit: unknown): Promise<boolean> {
  const own = await personalRoot(userId);
  const allowed = [project.folder + '/', NETWORK_MUSIC_FOLDER + '/', NETWORK_SOUNDS_FOLDER + '/'];
  if (own) allowed.push(`${own}/`);
  const paths: string[] = [];
  const walk = (x: unknown) => {
    if (!x || typeof x !== 'object') return;
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (k === 'path' && typeof v === 'string') paths.push(v);
      else walk(v);
    }
  };
  walk(edit);
  return paths.every((p) => !p.includes('..') && allowed.some((a) => p.startsWith(a)));
}

export async function saveReelProject(
  userId: string,
  id: string,
  patch: { title?: string; edit?: Record<string, unknown> }
): Promise<{ ok: boolean; project?: ReelProject; error?: string }> {
  const project = await getReelProject(userId, id);
  if (!project) return { ok: false, error: 'Not found' };
  if (patch.edit && !(await pathsAllowed(userId, project, patch.edit))) {
    return { ok: false, error: 'The edit names a file outside this project' };
  }
  const rows = await db<ProjectRow[]>`
    UPDATE reel_projects SET
      title = COALESCE(${patch.title?.trim() || null}, title),
      edit = COALESCE(${patch.edit ? db.json(patch.edit as never) : null}::jsonb, edit),
      updated_at = now()
    WHERE id = ${id} AND owner_id = ${userId}
    RETURNING *
  `;
  const saved = toProject(rows[0]);
  // Lineage: the files in the source slots become the reel's sources.
  if (patch.edit) await syncReelSources(saved, saved.edit);
  else if (patch.title) await ensureReelItem(saved);
  return { ok: true, project: saved };
}

export async function archiveReelProject(userId: string, id: string): Promise<boolean> {
  const rows = await db`
    UPDATE reel_projects SET archived_at = now() WHERE id = ${id} AND owner_id = ${userId} RETURNING id
  `;
  if (rows.length > 0) await archiveReelItem(userId, id);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

/**
 * Where an upload for a slot goes. Music is the person's own (private) music
 * folder, so it can be reused across projects and shared to the network
 * later; everything else goes into the project folder.
 */
export async function reelUploadPath(
  userId: string,
  projectId: string,
  slot: ReelSlot,
  filename: string
): Promise<{ ok: boolean; path?: string; error?: string }> {
  if (!REEL_SLOTS.includes(slot)) return { ok: false, error: 'Unknown slot' };
  const project = await getReelProject(userId, projectId);
  if (!project) return { ok: false, error: 'Not found' };
  const name = `${Date.now()}-${safeName(filename)}`;
  if (slot === 'music' || slot === 'sound') {
    const own = await personalRoot(userId);
    if (!own) return { ok: false, error: 'Your storage folder is not set up yet' };
    const folder = `${own}/Private/${slot === 'music' ? 'Music' : 'Sounds'}`;
    if (!(await mkdirs(folder))) return { ok: false, error: `Could not create your ${slot} folder` };
    return { ok: true, path: `${folder}/${name}` };
  }
  return { ok: true, path: `${project.folder}/${slot}-${name}` };
}

// ---------------------------------------------------------------------------
// Music
// ---------------------------------------------------------------------------

const AUDIO = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i;

export interface ReelMusicTrack {
  name: string;
  path: string;
  size: number;
}

const tracks = (entries: DavEntry[]): ReelMusicTrack[] =>
  entries
    .filter((e) => !e.isFolder && AUDIO.test(e.name))
    .map((e) => ({ name: e.name.replace(/^\d{13}-/, ''), path: e.path, size: e.size }));

export async function listReelMusic(userId: string): Promise<{ network: ReelMusicTrack[]; mine: ReelMusicTrack[] }> {
  const own = await personalRoot(userId);
  const [network, mine] = await Promise.all([
    davList(NETWORK_MUSIC_FOLDER),
    own ? davList(`${own}/Private/Music`) : Promise.resolve([] as DavEntry[]),
  ]);
  return { network: tracks(network), mine: tracks(mine) };
}

/** Copy one of the person's own tracks into the network music folder. */
export async function shareReelMusic(userId: string, path: string): Promise<{ ok: boolean; path?: string; error?: string }> {
  const own = await personalRoot(userId);
  if (!own || !path.startsWith(`${own}/Private/Music/`) || path.includes('..')) {
    return { ok: false, error: 'Only your own music can be shared' };
  }
  if (!(await mkdirs(NETWORK_MUSIC_FOLDER))) return { ok: false, error: 'Could not create the network music folder' };
  const target = `${NETWORK_MUSIC_FOLDER}/${path.split('/').pop()}`;
  if (!(await davCopy(path, target))) return { ok: false, error: 'A track with that name is already shared' };
  return { ok: true, path: target };
}

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------
// Network library: EAC_Network/oad/Private/Sounds/<Category>/<file>, read by
// `oad` members like the network music. Personal: <own>/Private/Sounds/.
// Each Sounds folder may hold a `sounds.json` crediting its files (source,
// licence, author), keyed by the path below that folder; a file without an
// entry is listed with what its folder and name say. Freesound imports are
// CC0 only and write their entry when they land.

export const NETWORK_SOUNDS_FOLDER = `${ROOT}/${PERSONAL_ORG_ID}/Private/Sounds`;
const SOUNDS_MANIFEST = 'sounds.json';

export interface ReelSoundCredit {
  title?: string;
  category?: string;
  tags?: string[];
  licence?: string;
  source?: string;
  author?: string;
  duration?: number;
}

export interface ReelSound extends ReelSoundCredit {
  name: string;
  path: string;
  size: number;
  category: string;
}

type SoundManifest = { version: 1; sounds: Record<string, ReelSoundCredit> };

async function readSoundManifest(folder: string): Promise<SoundManifest> {
  const text = await davGetText(`${folder}/${SOUNDS_MANIFEST}`);
  if (!text) return { version: 1, sounds: {} };
  try {
    const m = JSON.parse(text);
    return { version: 1, sounds: m && typeof m.sounds === 'object' ? m.sounds : {} };
  } catch {
    return { version: 1, sounds: {} };
  }
}

async function soundsIn(folder: string, fallbackCategory: string): Promise<ReelSound[]> {
  const [entries, manifest] = await Promise.all([davListDeep(folder, 4000), readSoundManifest(folder)]);
  return entries
    .filter((e) => AUDIO.test(e.name))
    .map((e) => {
      const rel = e.path.slice(folder.length + 1);
      const credit = manifest.sounds[rel] ?? {};
      const dir = rel.includes('/') ? rel.split('/')[0] : '';
      const name = e.name.replace(/^\d{13}-/, '');
      return {
        ...credit,
        name: credit.title || name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
        path: e.path,
        size: e.size,
        category: credit.category || dir || fallbackCategory,
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

export async function listReelSounds(userId: string): Promise<{ network: ReelSound[]; mine: ReelSound[] }> {
  const own = await personalRoot(userId);
  const [network, mine] = await Promise.all([
    soundsIn(NETWORK_SOUNDS_FOLDER, 'Other'),
    own ? soundsIn(`${own}/Private/Sounds`, 'Mine') : Promise.resolve([] as ReelSound[]),
  ]);
  return { network, mine };
}

async function addSoundCredit(folder: string, rel: string, credit: ReelSoundCredit): Promise<void> {
  const m = await readSoundManifest(folder);
  m.sounds[rel] = credit;
  const body = new TextEncoder().encode(JSON.stringify(m, null, 2));
  await davPut(`${folder}/${SOUNDS_MANIFEST}`, body, 'application/json');
}

/** Copy one of the person's own sounds into the network library (its credit goes with it). */
export async function shareReelSound(userId: string, path: string, category: string): Promise<{ ok: boolean; path?: string; error?: string }> {
  const own = await personalRoot(userId);
  const mineFolder = own ? `${own}/Private/Sounds` : null;
  if (!mineFolder || !path.startsWith(`${mineFolder}/`) || path.includes('..') || !AUDIO.test(path)) {
    return { ok: false, error: 'Only your own sounds can be shared' };
  }
  const cat = safeName(category.trim() || 'Other').replace(/\.+$/, '') || 'Other';
  const folder = `${NETWORK_SOUNDS_FOLDER}/${cat}`;
  if (!(await mkdirs(folder))) return { ok: false, error: 'Could not create the network sound folder' };
  const file = path.split('/').pop()!;
  const target = `${folder}/${file}`;
  if (!(await davCopy(path, target))) return { ok: false, error: 'A sound with that name is already shared there' };
  const credit = (await readSoundManifest(mineFolder)).sounds[path.slice(mineFolder.length + 1)] ?? {};
  await addSoundCredit(NETWORK_SOUNDS_FOLDER, `${cat}/${file}`, { ...credit, category: cat });
  return { ok: true, path: target };
}

// Freesound (freesound.org), CC0 sounds only. The API is free for
// non-commercial use (its terms); a key goes in FREESOUND_API_KEY. Imports
// take the HQ MP3 preview: originals need OAuth2 per user.
const FREESOUND = 'https://freesound.org/apiv2';
const FREESOUND_CC0 = 'Creative Commons 0';

export interface FreesoundHit {
  id: number;
  name: string;
  tags: string[];
  duration: number;
  author: string;
  url: string;
  preview: string;
}

export const freesoundConfigured = () => Boolean(process.env.FREESOUND_API_KEY);

async function freesoundGet(path: string, params: Record<string, string>): Promise<any | null> {
  const key = process.env.FREESOUND_API_KEY;
  if (!key) return null;
  const res = await fetch(`${FREESOUND}${path}?${new URLSearchParams(params)}`, { headers: { Authorization: `Token ${key}` } });
  if (!res.ok) {
    console.error(`[reels] freesound ${path} -> ${res.status}`);
    return null;
  }
  return res.json();
}

const FS_FIELDS = 'id,name,tags,duration,username,license,url,previews';
const toHit = (s: any): FreesoundHit | null =>
  s && s.license && /\/publicdomain\/zero\//.test(String(s.license)) && s.previews?.['preview-hq-mp3']
    ? {
        id: Number(s.id),
        name: String(s.name ?? ''),
        tags: Array.isArray(s.tags) ? s.tags.slice(0, 8).map(String) : [],
        duration: Number(s.duration) || 0,
        author: String(s.username ?? ''),
        url: String(s.url ?? ''),
        preview: String(s.previews['preview-hq-mp3']),
      }
    : null;

/** CC0 sounds matching `query`, up to 12 s long (sound effects, not tracks). */
export async function searchFreesound(query: string, page = 1): Promise<{ ok: boolean; hits?: FreesoundHit[]; more?: boolean; error?: string }> {
  if (!freesoundConfigured()) return { ok: false, error: 'Freesound search is not set up on this server' };
  const q = query.trim().slice(0, 100);
  if (!q) return { ok: true, hits: [], more: false };
  const data = await freesoundGet('/search/', {
    query: q,
    filter: `license:"${FREESOUND_CC0}" duration:[0 TO 12]`,
    fields: FS_FIELDS,
    page_size: '20',
    page: String(Math.max(1, Math.min(50, page))),
    sort: 'score',
  });
  if (!data) return { ok: false, error: 'Freesound did not answer' };
  // The licence is checked again per sound: the filter is Freesound's, the guarantee is ours.
  const hits = (data.results ?? []).map(toHit).filter(Boolean) as FreesoundHit[];
  return { ok: true, hits, more: Boolean(data.next) };
}

/** Fetch one CC0 sound's HQ preview into the person's own Sounds, with its credit. */
export async function importFreesound(userId: string, id: number): Promise<{ ok: boolean; sound?: ReelSound; error?: string }> {
  if (!freesoundConfigured()) return { ok: false, error: 'Freesound is not set up on this server' };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Unknown sound' };
  const own = await personalRoot(userId);
  if (!own) return { ok: false, error: 'Your storage folder is not set up yet' };
  const hit = toHit(await freesoundGet(`/sounds/${id}/`, { fields: FS_FIELDS }));
  if (!hit) return { ok: false, error: 'That sound is not CC0 or has no preview' };
  // Previews come from Freesound's CDN; refuse anything else.
  if (!/^https:\/\/cdn\.freesound\.org\//.test(hit.preview)) return { ok: false, error: 'Unexpected preview address' };
  const res = await fetch(hit.preview);
  if (!res.ok) return { ok: false, error: 'Could not fetch the sound' };
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > 8 * 1024 * 1024) return { ok: false, error: 'Too large for a sound effect' };
  const folder = `${own}/Private/Sounds`;
  if (!(await mkdirs(`${folder}/Freesound`))) return { ok: false, error: 'Could not create your sound folder' };
  const file = `${safeName(hit.name.replace(/\.[a-z0-9]{2,4}$/i, '')).slice(0, 80)}-fs${hit.id}.mp3`;
  const rel = `Freesound/${file}`;
  if (!(await davPut(`${folder}/${rel}`, buf, 'audio/mpeg'))) return { ok: false, error: 'Storage refused the file' };
  const credit: ReelSoundCredit = {
    title: hit.name.replace(/\.[a-z0-9]{2,4}$/i, ''),
    category: 'Freesound',
    tags: hit.tags,
    licence: 'CC0 1.0',
    source: hit.url,
    author: hit.author,
    duration: hit.duration,
  };
  await addSoundCredit(folder, rel, credit);
  return { ok: true, sound: { ...credit, name: credit.title!, path: `${folder}/${rel}`, size: buf.length, category: 'Freesound' } };
}

// ---------------------------------------------------------------------------
// Render queue
// ---------------------------------------------------------------------------

export async function queueReelRender(
  userId: string,
  projectId: string
): Promise<{ ok: boolean; render?: ReelRender; error?: string }> {
  const project = await getReelProject(userId, projectId);
  if (!project) return { ok: false, error: 'Not found' };
  if (!(await pathsAllowed(userId, project, project.edit))) {
    return { ok: false, error: 'The edit names a file outside this project' };
  }
  const busy = await db`
    SELECT 1 FROM reel_renders WHERE project_id = ${projectId} AND status IN ('queued', 'running') LIMIT 1
  `;
  if (busy.length) return { ok: false, error: 'This reel is already rendering' };
  const rows = await db<RenderRow[]>`
    INSERT INTO reel_renders (id, project_id, org_id, requested_by, edit, folder)
    VALUES (${nanoid(12)}, ${projectId}, ${project.orgId}, ${userId},
            ${db.json({ ...project.edit, template: project.template, title: project.title } as never)},
            ${project.folder})
    RETURNING *
  `;
  return { ok: true, render: toRender(rows[0]) };
}

export async function listReelRenders(userId: string, projectId: string): Promise<ReelRender[]> {
  const rows = await db<RenderRow[]>`
    SELECT r.* FROM reel_renders r JOIN reel_projects p ON p.id = r.project_id
    WHERE r.project_id = ${projectId} AND p.owner_id = ${userId}
    ORDER BY r.created_at DESC LIMIT 10
  `;
  return rows.map(toRender);
}

// ---------------------------------------------------------------------------
// Transcripts (migration 229): whisper.cpp in the reel-render worker
// ---------------------------------------------------------------------------

/** One spoken word, in seconds of the source file. */
export interface ReelWord {
  w: string;
  s: number;
  e: number;
}

export interface ReelTranscript {
  id: string;
  path: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  words: ReelWord[] | null;
  /** Silences in source seconds (migration 231); null before it or for older transcripts. */
  pauses: Array<{ s: number; e: number }> | null;
  /** Sound level for the waveform (migration 232): one byte per 1/rate s, base64; null before it. */
  peaks: { rate: number; data: string } | null;
  durationS: number | null;
  error: string | null;
  createdAt: string;
}

interface TranscriptRow {
  id: string;
  path: string;
  status: ReelTranscript['status'];
  progress: number;
  words: ReelWord[] | null;
  pauses?: Array<{ s: number; e: number }> | null;
  peaks?: { rate: number; data: string } | null;
  duration_s: number | null;
  error: string | null;
  created_at: Date;
}

const toTranscript = (r: TranscriptRow): ReelTranscript => ({
  id: r.id,
  path: r.path,
  status: r.status,
  progress: r.progress,
  words: r.words,
  pauses: r.pauses ?? null,
  peaks: r.peaks ?? null,
  durationS: r.duration_s,
  error: r.error,
  createdAt: r.created_at.toISOString(),
});

/**
 * Queue speech-to-text of a recording the project may use (its own folder or
 * the person's own storage, the same rule as an edit's paths). A transcript
 * already queued or running for the same file is returned instead.
 */
export async function queueReelTranscript(
  userId: string,
  projectId: string,
  path: string
): Promise<{ ok: boolean; transcript?: ReelTranscript; error?: string }> {
  const project = await getReelProject(userId, projectId);
  if (!project) return { ok: false, error: 'Not found' };
  if (!(await pathsAllowed(userId, project, { path }))) return { ok: false, error: 'That file is outside this project' };
  const busy = await db<TranscriptRow[]>`
    SELECT * FROM reel_transcripts
    WHERE project_id = ${projectId} AND org_id = ${project.orgId} AND path = ${path} AND status IN ('queued', 'running')
    ORDER BY created_at DESC LIMIT 1
  `;
  if (busy[0]) return { ok: true, transcript: toTranscript(busy[0]) };
  const rows = await db<TranscriptRow[]>`
    INSERT INTO reel_transcripts (id, project_id, org_id, requested_by, path, folder)
    VALUES (${nanoid(12)}, ${projectId}, ${project.orgId}, ${userId}, ${path}, ${project.folder})
    RETURNING *
  `;
  return { ok: true, transcript: toTranscript(rows[0]) };
}

/** The newest transcript of a recording in this project, any status; null when there is none. */
export async function getReelTranscript(userId: string, projectId: string, path: string): Promise<ReelTranscript | null> {
  const project = await getReelProject(userId, projectId);
  if (!project) return null;
  const rows = await db<TranscriptRow[]>`
    SELECT * FROM reel_transcripts
    WHERE project_id = ${projectId} AND org_id = ${project.orgId} AND path = ${path}
    ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0] ? toTranscript(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Finished reels, for reuse as a segment of another reel
// ---------------------------------------------------------------------------

export interface FinishedReel {
  projectId: string;
  title: string;
  outputPath: string;
  thumbPath: string | null;
  durationS: number | null;
  finishedAt: string;
}

/** The person's latest finished render of each reel, newest first. */
export async function listFinishedReels(userId: string): Promise<FinishedReel[]> {
  const rows = await db<Array<{
    project_id: string; title: string; output_path: string; thumb_path: string | null;
    duration_s: number | null; finished_at: Date;
  }>>`
    SELECT DISTINCT ON (r.project_id) r.project_id, p.title, r.output_path, r.thumb_path, r.duration_s, r.finished_at
    FROM reel_renders r JOIN reel_projects p ON p.id = r.project_id
    WHERE p.owner_id = ${userId} AND r.status = 'done' AND r.output_path IS NOT NULL
    ORDER BY r.project_id, r.finished_at DESC
  `;
  return rows
    .map((r) => ({
      projectId: r.project_id,
      title: r.title,
      outputPath: r.output_path,
      thumbPath: r.thumb_path,
      durationS: r.duration_s,
      finishedAt: r.finished_at.toISOString(),
    }))
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}

// ---------------------------------------------------------------------------
// Publishing: a reel becomes a writing piece on the person's page
// ---------------------------------------------------------------------------

/**
 * A published reel is a `writing` thread (writing.ts) whose metadata.video
 * points at a PUBLIC copy of the latest render. Writing already has the
 * person's page, "Show on" listings, byline and SEO, and is off every feed
 * (thread-kinds.ts), so a reel needs no new kind. The copy is needed because
 * the render lives under Private/, which anonymous readers are refused:
 *   users/<storage folder>/Media/Videos/reel-<project id>.mp4  (+ .jpg poster)
 * Publishing again overwrites the copy and updates the same piece, found by
 * metadata.video.reelId.
 */
export interface ReelPublication {
  threadId: string;
  slug: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
}

async function davCopyOver(from: string, to: string): Promise<boolean> {
  const res = await fetch(davUrl(from), {
    method: 'COPY',
    headers: { Authorization: davAuthHeader(), Destination: davUrl(to), Overwrite: 'T' },
  });
  return res.ok;
}

export async function getReelPublication(userId: string, projectId: string): Promise<ReelPublication | null> {
  const rows = await db<Array<{ id: string; slug: string; status: string; published_at: Date | null }>>`
    SELECT id, slug, status, published_at FROM threads
    WHERE kind = 'writing' AND author_id = ${userId} AND status IN ('draft', 'published')
      AND metadata->'video'->>'reelId' = ${projectId}
    ORDER BY created_at DESC LIMIT 1
  `;
  const r = rows[0];
  return r
    ? { threadId: r.id, slug: r.slug, status: r.status === 'published' ? 'published' : 'draft', publishedAt: r.published_at?.toISOString() ?? null }
    : null;
}

export async function publishReel(
  userId: string,
  projectId: string,
  opts: { description?: string } = {}
): Promise<{ ok: boolean; publication?: ReelPublication; error?: string }> {
  const project = await getReelProject(userId, projectId);
  if (!project) return { ok: false, error: 'Not found' };
  const [render] = await db<Array<{ output_path: string; thumb_path: string | null; duration_s: number | null }>>`
    SELECT output_path, thumb_path, duration_s FROM reel_renders
    WHERE project_id = ${projectId} AND status = 'done' AND output_path IS NOT NULL
    ORDER BY finished_at DESC LIMIT 1
  `;
  if (!render) return { ok: false, error: 'Render the reel first' };
  const own = await personalRoot(userId);
  if (!own) return { ok: false, error: 'Your storage folder is not set up yet' };

  const videoPath = `${own}/Media/Videos/reel-${projectId}.mp4`;
  const posterPath = render.thumb_path ? `${own}/Media/Images/reel-${projectId}.jpg` : null;
  if (!(await mkdirs(`${own}/Media/Videos`)) || !(await davCopyOver(render.output_path, videoPath))) {
    return { ok: false, error: 'Could not make the public copy of the video' };
  }
  if (posterPath && render.thumb_path) {
    await mkdirs(`${own}/Media/Images`);
    await davCopyOver(render.thumb_path, posterPath);
  }
  // Each publish gets a new query string, so readers' caches do not keep an
  // older cut under the same path.
  const v = Date.now().toString(36);
  const video = {
    src: `/api/media/${videoPath}?v=${v}`,
    poster: posterPath ? `/api/media/${posterPath}?v=${v}` : null,
    durationS: render.duration_s,
    reelId: projectId,
  };

  // Imported here, not at the top: writing.ts pulls in the sanitizer and
  // listing code, which nothing else in this module needs.
  const { createWritingPost, updateWritingPost } = await import('./writing');
  let existing = await getReelPublication(userId, projectId);
  if (!existing) {
    const created = await createWritingPost({ authorId: userId, orgId: project.orgId, title: project.title });
    if (created.ok === false) return { ok: false, error: created.error };
    existing = { threadId: created.post.id, slug: created.post.slug, status: 'draft', publishedAt: null };
  }
  const saved = await updateWritingPost(existing.threadId, {
    title: project.title,
    coverImageUrl: video.poster,
    video,
    ...(opts.description !== undefined ? { bodyHtml: opts.description ? `<p>${escapeHtml(opts.description)}</p>` : '' } : {}),
    status: 'published',
  });
  if (saved.ok === false) return { ok: false, error: saved.error };
  await linkReelPublished(project, saved.post.id);
  return {
    ok: true,
    publication: { threadId: saved.post.id, slug: saved.post.slug, status: 'published', publishedAt: saved.post.publishedAt },
  };
}

/** Back to draft: the piece leaves the person's page; the public copy stays for a re-publish. */
export async function unpublishReel(userId: string, projectId: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await getReelPublication(userId, projectId);
  if (!existing) return { ok: true };
  const { updateWritingPost } = await import('./writing');
  const res = await updateWritingPost(existing.threadId, { status: 'draft' });
  return res.ok === false ? { ok: false, error: res.error } : { ok: true };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
