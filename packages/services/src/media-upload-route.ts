import { Buffer } from 'node:buffer';
import { nanoid } from 'nanoid';
import { db } from '@elkdonis/db';
import { validateUploadBuffer } from '@elkdonis/utils';
import { getProxyFileUrl, uploadFile, uploadFilename } from './nextcloud';
import { createOrgFolder, resolveOrgPath } from './org-storage';
import { createUserFolder, getStorageSlug, resolveUserPath } from './user-storage';

// ============================================================================
// The editor's image upload route (`/api/media/upload`), once.
//
// danamccool and katie-the-potter each carried a ~100-line copy: gate, read the
// form, check type and size, name the file after its title, build a Nextcloud
// path that cannot leave the owner's (or the org's) folder, sniff the bytes,
// store, insert a `media` row, answer `{ success, id, url, filename, size }`.
// The copies differ only in WHERE a file goes and in how kindly they word a
// refusal, so those are the options.
//
//   // app/api/media/upload/route.ts
//   export const { POST } = mediaUploadRoute({
//     orgId: siteConfig.orgId,
//     label: "danamccool",
//     canEdit: async () => { const v = await getViewer(); return v?.canEdit ? { userId: v.userId } : null; },
//     ownerUserId: getSiteOwnerUserId,
//   });
//
// Images only. This is NOT the multi-kind pipeline (`uploadRoutes`, which also
// re-encodes); it stores the bytes as sent, as both sites always have.
//
// Takes a standard Request and answers with Response.json, so this package
// needs no `next` dependency (same as mediaRoutes).
// ============================================================================

export interface MediaUploadMessages {
  unauthorized: string;
  noFile: string;
  /** Given the browser's MIME type, or "" when it sent none. */
  badType: (mime: string) => string;
  /** Given the file's size in bytes. */
  tooLarge: (bytes: number, maxMb: number) => string;
  heic: string;
  unknownGallery: string;
  noOwner: string;
  /** The owner's storage folder is missing and could not be made. */
  noStorage: string;
  galleryFolder: string;
  /** The sniffed bytes are not an image; given the sniffer's reason when it has one. */
  unreadable: (reason: string | undefined) => string;
  storeFailed: string;
  internal: string;
}

const DEFAULT_MESSAGES: MediaUploadMessages = {
  unauthorized: 'Unauthorized',
  noFile: 'No file provided',
  badType: (mime) => `Unsupported file type: ${mime || 'unknown'}`,
  tooLarge: (_bytes, maxMb) => `File size must be less than ${maxMb}MB`,
  heic: 'HEIC photo: please send a JPEG.',
  unknownGallery: 'Unknown gallery',
  noOwner: 'The site owner has no storage folder yet',
  noStorage: 'The site owner has no storage folder yet',
  galleryFolder: 'Could not create the gallery folder',
  unreadable: (reason) => reason ?? 'Rejected',
  storeFailed: 'Failed to upload file to Nextcloud',
  internal: 'Internal server error',
};

export interface MediaUploadRouteOptions {
  /** The site's org: stamped on the `media` row, and the org folder when `target` is "org". */
  orgId: string;
  /** Used in the server log line: `[<label>] upload error:`. */
  label: string;
  /**
   * The gate. Resolve the signed-in editor, or null/undefined to refuse (401).
   * The uploader's id is what `media.uploaded_by` records.
   */
  canEdit: (request: Request) => Promise<{ userId: string } | null | undefined>;
  /**
   * Whose folder a picture with no `gallery` goes to:
   *   "owner" (default) users/<owner slug>/Media/Images
   *   "org"             <org>/Media/Images
   * A picture WITH a `gallery` always goes to the owner's Galleries/<gallery>
   * (that is where user_galleries expects it), so `ownerUserId` is needed
   * either way once a gallery is sent.
   */
  target?: 'owner' | 'org';
  /** The site owner (from the membership table, never from the request). */
  ownerUserId?: () => Promise<string | null>;
  /**
   * Called when the owner has no storage slug yet; return true if it made the
   * folder, and the slug is looked up once more (katie's ensurePictureFolder).
   */
  ensureOwnerFolder?: (ownerUserId: string) => Promise<boolean>;
  /**
   * When the first store fails, make the likely-missing folders and try once
   * more. Default false (the store is attempted once).
   */
  retryOnFailure?: boolean;
  /** Run by the retry, before it, for an owner path (katie: ensurePictureFolder). */
  ensureFoldersOnRetry?: (ownerUserId: string) => Promise<unknown>;
  /** Default 25. */
  maxSizeMb?: number;
  /** Status for the too-large refusal. Default 400. */
  tooLargeStatus?: number;
  /** Refuse iPhone HEIC/HEIF (415) rather than storing a picture most browsers cannot show. Default false. */
  rejectHeic?: boolean;
  /** Override any refusal wording. */
  messages?: Partial<MediaUploadMessages>;
}

const HEIC = /^image\/hei[cf]/i;
const GALLERY = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function mediaUploadRoute(opts: MediaUploadRouteOptions) {
  const msg: MediaUploadMessages = { ...DEFAULT_MESSAGES, ...opts.messages };
  const target = opts.target ?? 'owner';
  const maxMb = opts.maxSizeMb ?? 25;
  const fail = (error: string, status: number) => Response.json({ error }, { status });

  async function POST(request: Request): Promise<Response> {
    try {
      const viewer = await opts.canEdit(request);
      if (!viewer) return fail(msg.unauthorized, 401);

      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) return fail(msg.noFile, 400);
      if (opts.rejectHeic && (HEIC.test(file.type) || /\.(heic|heif)$/i.test(file.name))) {
        return fail(msg.heic, 415);
      }
      if (!file.type.startsWith('image/')) return fail(msg.badType(file.type), 400);
      if (file.size > maxMb * 1024 * 1024) {
        return fail(msg.tooLarge(file.size, maxMb), opts.tooLargeStatus ?? 400);
      }

      // Named after the work when the surface sends a title, else after the
      // uploaded file. This address outlives the upload — it is what a stored
      // page, a gallery item and every <img src> carries. See uploadFilename.
      const title = String(formData.get('title') ?? '').trim().slice(0, 200);
      const filename = uploadFilename(file.name, title || null);
      const gallery = String(formData.get('gallery') ?? '').trim();

      // Order matters only for which refusal a doubly-bad request gets: with an
      // owner target the owner is looked up first (danamccool), with an org
      // target the gallery name is checked first (katie).
      const galleryOk = !gallery || GALLERY.test(gallery);
      if (target === 'org' && !galleryOk) return fail(msg.unknownGallery, 400);

      let ownerId: string | null = null;
      let relativePath: string;
      if (target === 'org' && !gallery) {
        relativePath = resolveOrgPath(opts.orgId, `Media/Images/${filename}`);
      } else {
        ownerId = (await opts.ownerUserId?.()) ?? null;
        if (!ownerId) return fail(msg.noOwner, 500);
        let slug = await getStorageSlug(ownerId);
        if (!slug && opts.ensureOwnerFolder && (await opts.ensureOwnerFolder(ownerId))) {
          slug = await getStorageSlug(ownerId);
        }
        if (!slug) return fail(msg.noStorage, 500);
        if (!galleryOk) return fail(msg.unknownGallery, 400);
        // A gallery's folder may not exist yet — WebDAV PUT into a missing
        // folder fails (409), so make it first. Idempotent.
        if (gallery && !(await createUserFolder(slug, `Galleries/${gallery}`))) {
          return fail(msg.galleryFolder, 500);
        }
        relativePath = resolveUserPath(
          slug,
          gallery ? `Galleries/${gallery}/${filename}` : `Media/Images/${filename}`
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      // Client-supplied MIME is attacker-controlled and `image/svg+xml` passes
      // `startsWith("image/")` — verify the real leading bytes instead.
      const validation = validateUploadBuffer(buffer, ['image']);
      if (opts.rejectHeic && validation.ok && HEIC.test(validation.sniffed.mime)) {
        return fail(msg.heic, 415);
      }
      if (!validation.ok) {
        return fail(msg.unreadable('reason' in validation ? validation.reason : undefined), 415);
      }

      let stored = await uploadFile(relativePath, buffer, file.type);
      if (!stored && opts.retryOnFailure) {
        // Most often the folder isn't there yet: make it, then once more.
        if (ownerId) await opts.ensureFoldersOnRetry?.(ownerId);
        else {
          await createOrgFolder(opts.orgId, 'Media');
          await createOrgFolder(opts.orgId, 'Media/Images');
        }
        stored = await uploadFile(relativePath, buffer, file.type);
      }
      if (!stored) return fail(msg.storeFailed, 500);

      const fileUrl = getProxyFileUrl(relativePath);
      const mediaId = nanoid();

      await db`
        INSERT INTO media (id, org_id, uploaded_by, nextcloud_file_id, nextcloud_path, url, type, filename, size_bytes, mime_type)
        VALUES (${mediaId}, ${opts.orgId}, ${viewer.userId}, ${filename}, ${relativePath}, ${fileUrl}, 'image', ${file.name}, ${file.size}, ${file.type})
      `;

      return Response.json({ success: true, id: mediaId, url: fileUrl, filename: file.name, size: file.size });
    } catch (error) {
      console.error(`[${opts.label}] upload error:`, error);
      return fail(msg.internal, 500);
    }
  }
  return { POST };
}
