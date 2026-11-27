/**
 * One upload path (design: docs/open/UPLOADS_ONE_PATH_2026-11-16.md).
 *
 * `storeUpload` is the only function that should turn "a person sent bytes"
 * into "a file in Nextcloud and a URL": it sizes by COUNTED bytes, sniffs the
 * real type (never the browser's MIME), re-encodes images, builds a destination
 * that cannot leave the org or person root, names the file, stores it and
 * returns one response shape. Routes are thin callers (see upload-routes.ts).
 *
 * NOT an authorization boundary. The caller (the route factory) decides WHO may
 * upload; this function only guarantees WHERE the bytes can go. The one
 * exception is an org-scoped avatar, which checks that the person belongs to
 * the org before it writes the org half of their profile.
 */
import { nanoid } from 'nanoid';
import { db } from '@elkdonis/db';
import { validateUploadBuffer, type SniffedKind } from '@elkdonis/utils';
import { davMkcol, davPut } from './dav';
import { getProxyFileUrl, uploadFilename } from './nextcloud';
import { orgStorageRoot, resolveOrgPath } from './org-storage';
import { createUserFolder, getStorageSlug, resolveUserPath, userStorageRoot } from './user-storage';
import { processImage, UploadRefusal } from './image-process';

export { UploadRefusal } from './image-process';

const MB = 1024 * 1024;
const MASTER_QUALITY = 95;

export type UploadKind = 'avatar' | 'site' | 'personal' | 'artwork' | 'forum';
export type MediaFolder = 'Images' | 'Audio' | 'Videos' | 'Documents';
export type Visibility = 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';

export interface Policy {
  kinds: SniffedKind[];
  allowText?: boolean;
  /** cap in bytes per SNIFFED kind; a kind with no cap is not accepted */
  caps: Partial<Record<SniffedKind, number>>;
  /** images: strip metadata (and optionally shrink); false keeps them as sent */
  reencode: false | { maxEdge?: number; quality?: number };
  /** write a library row (`media`) for the stored file when an org is known */
  record: boolean;
}

export const UPLOAD_POLICIES: Record<UploadKind, Policy> = {
  avatar: { kinds: ['image'], caps: { image: 8 * MB }, reencode: { maxEdge: 1024 }, record: false },
  site: {
    kinds: ['image', 'audio', 'video', 'document'],
    allowText: true,
    caps: { image: 25 * MB, audio: 150 * MB, video: 500 * MB, document: 50 * MB },
    // A master: the thumbnail route serves the small sizes, so keep this one near-lossless.
    reencode: { quality: MASTER_QUALITY },
    record: true,
  },
  personal: {
    kinds: ['image'],
    caps: { image: 25 * MB, audio: 100 * MB, video: 100 * MB, document: 100 * MB },
    reencode: {},
    record: true,
  },
  artwork: { kinds: ['image', 'video'], caps: { image: 25 * MB, video: 250 * MB }, reencode: { quality: MASTER_QUALITY }, record: false },
  forum: { kinds: ['image', 'video'], caps: { image: 15 * MB, video: 100 * MB }, reencode: {}, record: true },
};

/** An app may only TIGHTEN a policy: lower caps, fewer kinds, never more. */
export function applyNarrow(base: Policy, narrow?: Partial<Policy>): Policy {
  if (!narrow) return base;
  const kinds = narrow.kinds ? base.kinds.filter((k) => narrow.kinds!.includes(k)) : base.kinds;
  const caps: Policy['caps'] = {};
  for (const k of Object.keys(base.caps) as SniffedKind[]) {
    const b = base.caps[k];
    const n = narrow.caps?.[k];
    // a kind narrowed away loses its cap too, so the body-size gate tightens with it
    if (b !== undefined && kinds.includes(k)) caps[k] = n !== undefined ? Math.min(b, n) : b;
  }
  return { ...base, kinds, caps, allowText: base.allowText && narrow.allowText !== false };
}

/** The largest body any listed kind accepts: what a factory refuses by Content-Length before reading. */
export function maxUploadBytes(kinds: UploadKind[], narrow?: Partial<Record<UploadKind, Partial<Policy>>>): number {
  let max = 0;
  for (const k of kinds) {
    const p = applyNarrow(UPLOAD_POLICIES[k], narrow?.[k]);
    for (const c of Object.values(p.caps)) max = Math.max(max, c ?? 0);
  }
  return max;
}

export interface UploadActor {
  userId: string;
}

export interface StoreUploadInput {
  kind: UploadKind;
  actor: UploadActor;
  file: { name: string; type?: string; bytes: Uint8Array };
  /** site, forum, personal(record) and org-scoped avatars: the org whose root confines the write */
  orgId?: string;
  /** personal, artwork: whose tree. Defaults to the actor. The CALLER must have authorised it. */
  ownerUserId?: string;
  visibility?: Visibility;
  /** personal only: one of the four media folders */
  folder?: MediaFolder;
  /** personal only: ^[a-z0-9][a-z0-9-]{0,79}$ */
  gallery?: string;
  title?: string;
  narrow?: Partial<Policy>;
}

export interface StoredUpload {
  ok: true;
  /** `media` row id, or null when no library row was written */
  id: string | null;
  url: string;
  path: string;
  /** stored file name */
  name: string;
  /** the name the person sent */
  filename: string;
  mimeType: string;
  size: number;
  mediaType: 'image' | 'audio' | 'video' | 'document';
  width?: number;
  height?: number;
  /** org avatars: whether org_profiles.photo_override was updated */
  recorded?: boolean;
  /** org avatars: the version row id, when the versions table exists */
  versionId?: string | null;
}
export interface RefusedUpload {
  ok: false;
  status: 400 | 403 | 409 | 413 | 415 | 422 | 502;
  error: string;
}
export type StoreUploadResult = StoredUpload | RefusedUpload;

export interface LibraryItem {
  orgId: string;
  uploadedBy: string;
  path: string;
  url: string;
  storedName: string;
  originalName: string;
  mime: string;
  size: number;
  mediaType: 'image' | 'audio' | 'video' | 'document';
  width?: number;
  height?: number;
}

/** Everything `storeUpload` touches outside itself, so tests can run with no Nextcloud or DB. */
export interface UploadIO {
  put(path: string, bytes: Uint8Array, mime: string): Promise<boolean>;
  /** make the folder and every missing parent below `root` (idempotent) */
  mkdirs(root: string, folderPath: string): Promise<boolean>;
  storageSlug(userId: string): Promise<string | null>;
  /** create a folder in a person's tree (no longer marks them an artist, 2026-11-24: doc open question 3) */
  ensureUserFolder(slug: string, relative: string): Promise<boolean>;
  /** THE SEAM for the content library: see registerLibraryItem below */
  registerLibraryItem(item: LibraryItem): Promise<string | null>;
  /** org avatars */
  isOrgMember(userId: string, orgId: string): Promise<boolean>;
  recordOrgAvatar(a: {
    userId: string;
    orgId: string;
    url: string;
    path: string;
    by: string;
  }): Promise<{ recorded: boolean; versionId: string | null }>;
}

/**
 * THE CONTENT-LIBRARY SEAM (one function).
 *
 * docs/open/CONTENT_LIBRARY_COMPONENT_2026-11-08.md describes a library of
 * THREADS and ARTWORKS (`@elkdonis/content`); it has no media-item concept yet,
 * and `studio_items` (kind recording/file) is a person's Studio lineage, not a
 * library. The only library of media that exists today is the `media` table
 * that every picker's "Library" tab lists (`/api/media/library/mine`,
 * `/api/my-media`), so that is what this writes. When media items join the
 * content library, change THIS function (and nothing else) to create or attach
 * the item there.
 */
export async function registerLibraryItem(item: LibraryItem): Promise<string | null> {
  const id = nanoid();
  try {
    await db`
      INSERT INTO media (
        id, org_id, uploaded_by, nextcloud_file_id, nextcloud_path, url, type,
        filename, size_bytes, mime_type, width, height
      ) VALUES (
        ${id}, ${item.orgId}, ${item.uploadedBy}, ${item.storedName}, ${item.path}, ${item.url},
        ${item.mediaType}, ${item.originalName}, ${item.size}, ${item.mime},
        ${item.width ?? null}, ${item.height ?? null}
      )
    `;
    return id;
  } catch (error) {
    // The file is stored and readable either way; a missing index row must not
    // read to the person as a failed upload.
    console.error('[uploads] library row not recorded:', (error as Error).message);
    return null;
  }
}

async function defaultIsOrgMember(userId: string, orgId: string): Promise<boolean> {
  try {
    const rows = await db<Array<{ x: number }>>`
      SELECT 1 AS x FROM user_organizations WHERE user_id = ${userId} AND org_id = ${orgId} AND role <> 'viewer'
      UNION ALL SELECT 1 FROM org_profiles WHERE user_id = ${userId} AND org_id = ${orgId}
      LIMIT 1
    `;
    return rows.length > 0;
  } catch (error) {
    console.error('[uploads] isOrgMember:', (error as Error).message);
    return false;
  }
}

const TABLE_MISSING = '42P01';

/**
 * Org avatar: current value in `org_profiles.photo_override` (exists since
 * migration 084), history in `profile_avatar_versions` (migration 276, written
 * but not applied everywhere: its absence is tolerated and only costs the
 * history).
 */
async function defaultRecordOrgAvatar(a: {
  userId: string;
  orgId: string;
  url: string;
  path: string;
  by: string;
}): Promise<{ recorded: boolean; versionId: string | null }> {
  let recorded = false;
  try {
    const rows = await db<Array<{ user_id: string }>>`
      INSERT INTO org_profiles (org_id, user_id, photo_override)
      VALUES (${a.orgId}, ${a.userId}, ${a.url})
      ON CONFLICT (org_id, user_id) DO UPDATE SET photo_override = EXCLUDED.photo_override
      RETURNING user_id
    `;
    recorded = rows.length > 0;
  } catch (error) {
    console.error('[uploads] org avatar not recorded:', (error as Error).message);
  }
  let versionId: string | null = null;
  try {
    await db`UPDATE profile_avatar_versions SET is_current = false
             WHERE user_id = ${a.userId} AND org_id = ${a.orgId} AND is_current`;
    versionId = nanoid();
    await db`
      INSERT INTO profile_avatar_versions (id, user_id, org_id, url, path, created_by, is_current)
      VALUES (${versionId}, ${a.userId}, ${a.orgId}, ${a.url}, ${a.path}, ${a.by}, true)
    `;
  } catch (error) {
    versionId = null;
    if ((error as { code?: string }).code !== TABLE_MISSING) {
      console.error('[uploads] avatar version not recorded:', (error as Error).message);
    }
  }
  return { recorded, versionId };
}

const defaultIO: UploadIO = {
  put: (path, bytes, mime) => davPut(path, bytes, mime),
  async mkdirs(root, folderPath) {
    const rel = folderPath.slice(root.length).replace(/^\/+/, '');
    let cur = root;
    if (!(await davMkcol(cur))) return false;
    for (const part of rel.split('/').filter(Boolean)) {
      cur = `${cur}/${part}`;
      if (!(await davMkcol(cur))) return false;
    }
    return true;
  },
  storageSlug: getStorageSlug,
  async ensureUserFolder(slug, relative) {
    return (await davMkcol(userStorageRoot(slug))) && (await createUserFolder(slug, relative));
  },
  registerLibraryItem,
  isOrgMember: defaultIsOrgMember,
  recordOrgAvatar: defaultRecordOrgAvatar,
};

/**
 * The reader half of per-org avatars: org first, then the network profile.
 * Returns null when the person has neither.
 */
export async function resolveAvatarUrl(userId: string, orgId?: string | null): Promise<string | null> {
  try {
    if (orgId) {
      const rows = await db<Array<{ url: string | null }>>`
        SELECT COALESCE(
          (SELECT NULLIF(photo_override, '') FROM org_profiles WHERE org_id = ${orgId} AND user_id = ${userId}),
          NULLIF(u.avatar_url, '')
        ) AS url FROM users u WHERE u.id = ${userId}
      `;
      return rows[0]?.url ?? null;
    }
    const rows = await db<Array<{ url: string | null }>>`
      SELECT NULLIF(avatar_url, '') AS url FROM users WHERE id = ${userId}
    `;
    return rows[0]?.url ?? null;
  } catch (error) {
    console.error('[uploads] resolveAvatarUrl:', (error as Error).message);
    return null;
  }
}

const GALLERY_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const FOLDERS: MediaFolder[] = ['Images', 'Audio', 'Videos', 'Documents'];
const FOLDER_KIND: Record<MediaFolder, SniffedKind> = {
  Images: 'image',
  Audio: 'audio',
  Videos: 'video',
  Documents: 'document',
};
const KIND_FOLDER: Record<string, MediaFolder> = {
  image: 'Images',
  audio: 'Audio',
  video: 'Videos',
  document: 'Documents',
};

const refuse = (status: RefusedUpload['status'], error: string): RefusedUpload => ({ ok: false, status, error });

/**
 * Size + sniff, the front half every kind shares (and the part pipeline card
 * attachments, streaming routes and the chunked recorder can adopt alone).
 */
export function checkUpload(
  bytes: Uint8Array,
  policy: Policy
): { ok: true; mime: string; kind: SniffedKind } | RefusedUpload {
  if (bytes.byteLength === 0) return refuse(400, 'That file is empty');
  const biggest = Math.max(0, ...Object.values(policy.caps).map((c) => c ?? 0));
  if (bytes.byteLength > biggest) {
    return refuse(413, `That file is over the ${Math.round(biggest / MB)} MB limit`);
  }
  const v = validateUploadBuffer(bytes, policy.kinds, { allowText: policy.allowText });
  // Signature-less text is the loophole: HTML or script sniffs as "text", so
  // text is accepted only when it does not look like markup.
  if (v.ok && v.sniffed.mime === 'text/plain') {
    const head = String.fromCharCode(...bytes.subarray(0, 64)).trimStart();
    if (head.startsWith('<')) return refuse(415, 'Markup files are not accepted here');
  }
  if (!v.ok) {
    const reason = 'reason' in v ? v.reason : 'That file type is not accepted';
    return refuse(415, /svg/.test(reason) ? 'SVG files are not accepted here' : reason);
  }
  const cap = policy.caps[v.sniffed.kind];
  if (cap === undefined) return refuse(415, 'That file type is not accepted here');
  if (bytes.byteLength > cap) {
    return refuse(413, `Files of this kind must be under ${Math.round(cap / MB)} MB`);
  }
  return { ok: true, mime: v.sniffed.mime, kind: v.sniffed.kind };
}

export async function storeUpload(input: StoreUploadInput, io: Partial<UploadIO> = {}): Promise<StoreUploadResult> {
  const X: UploadIO = { ...defaultIO, ...io };
  try {
    return await run(input, X);
  } catch (err) {
    if (err instanceof UploadRefusal) return refuse(err.status as RefusedUpload['status'], err.message);
    console.error('[uploads] storeUpload:', err);
    return refuse(502, 'Upload failed');
  }
}

async function run(input: StoreUploadInput, X: UploadIO): Promise<StoreUploadResult> {
  const { kind, actor, file } = input;
  let policy = UPLOAD_POLICIES[kind];
  if (!policy) return refuse(400, 'Unknown upload kind');

  // personal: the folder decides the accepted kind (my-files semantics)
  let folder: MediaFolder | null = null;
  if (kind === 'personal') {
    folder = input.folder ?? 'Images';
    if (!FOLDERS.includes(folder)) return refuse(400, `folder must be one of ${FOLDERS.join(', ')}`);
    policy = { ...policy, kinds: [FOLDER_KIND[folder]], allowText: folder === 'Documents' };
  }
  policy = applyNarrow(policy, input.narrow);
  // Plain text has no signature, so it is allowed only when the person SAID it is text.
  if (policy.allowText) {
    const saidText = file.type === 'text/plain' || /\.(txt|md|csv)$/i.test(file.name);
    policy = { ...policy, allowText: saidText };
  }

  const checked = checkUpload(file.bytes, policy);
  if ("status" in checked) return checked;
  let mime = checked.mime;
  let data: Uint8Array = file.bytes;
  let width: number | undefined;
  let height: number | undefined;
  let ext: string | null = null;

  if (checked.kind === 'image' && policy.reencode) {
    const out = await processImage(file.bytes, { maxEdge: policy.reencode.maxEdge, quality: policy.reencode.quality });
    data = out.data;
    mime = out.mime;
    width = out.width;
    height = out.height;
    ext = out.reencoded ? out.ext : null;
  }

  // ---- destination: the only place a path is built -----------------------
  let name = uploadFilename(file.name, input.title ?? null);
  if (ext) name = name.replace(/\.[a-z0-9]+$/i, '') + `.${ext}`;

  const orgFolder = async (rel: string): Promise<string> => {
    if (!input.orgId) throw new UploadRefusal(400, 'An organisation is required for this upload');
    const dir = resolveOrgPath(input.orgId, rel); // throws on escape
    if (!(await X.mkdirs(orgStorageRoot(input.orgId), dir))) throw new UploadRefusal(502, 'Could not prepare the folder');
    return dir;
  };

  const userFolder = async (ownerId: string, rel: string): Promise<string> => {
    const slug = await X.storageSlug(ownerId);
    if (!slug) throw new UploadRefusal(409, 'Your storage is not set up yet');
    const dir = resolveUserPath(slug, rel); // throws on escape
    if (!(await X.ensureUserFolder(slug, rel))) throw new UploadRefusal(502, 'Could not prepare your storage folder');
    return dir;
  };

  const vis = input.visibility ?? 'PUBLIC';
  const mediaRoot = vis === 'PUBLIC' ? 'Media' : 'Private/Media';
  const sniffedFolder = KIND_FOLDER[checked.kind] ?? 'Documents';
  let orgForRow: string | undefined = input.orgId;
  let path: string;

  if (kind === 'avatar') {
    if (input.orgId) {
      if (!(await X.isOrgMember(actor.userId, input.orgId))) {
        return refuse(403, 'You are not part of this organisation');
      }
      path = `${await orgFolder('Media/Images/Avatars')}/${name}`;
    } else {
      // The network avatar always lands in the actor's OWN tree; ownerUserId is ignored.
      path = `${await userFolder(actor.userId, 'Media/Images')}/${name}`;
      orgForRow = undefined;
    }
  } else if (kind === 'site' || kind === 'forum') {
    path = `${await orgFolder(`${mediaRoot}/${sniffedFolder}`)}/${name}`;
  } else if (kind === 'personal' || kind === 'artwork') {
    const owner = input.ownerUserId ?? actor.userId;
    let rel: string;
    if (kind === 'artwork') {
      rel = `Media/${sniffedFolder}`;
    } else if (input.gallery) {
      if (!GALLERY_RE.test(input.gallery)) return refuse(400, 'Unknown gallery');
      rel = `Galleries/${input.gallery}`;
    } else {
      rel = `Media/${folder}`;
    }
    path = `${await userFolder(owner, rel)}/${name}`;
  } else {
    return refuse(400, 'Unknown upload kind');
  }

  if (!(await X.put(path, data, mime))) return refuse(502, 'Storage refused the file');
  const url = getProxyFileUrl(path);

  const result: StoredUpload = {
    ok: true,
    id: null,
    url,
    path,
    name,
    filename: file.name,
    mimeType: mime,
    size: data.byteLength,
    mediaType: checked.kind === 'svg' ? 'image' : checked.kind,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };

  if (policy.record && orgForRow) {
    result.id = await X.registerLibraryItem({
      orgId: orgForRow,
      uploadedBy: actor.userId,
      path,
      url,
      storedName: name,
      originalName: file.name,
      mime,
      size: data.byteLength,
      mediaType: result.mediaType,
      width,
      height,
    });
  }

  if (kind === 'avatar' && input.orgId) {
    const r = await X.recordOrgAvatar({ userId: actor.userId, orgId: input.orgId, url, path, by: actor.userId });
    result.recorded = r.recorded;
    result.versionId = r.versionId;
  }
  return result;
}
