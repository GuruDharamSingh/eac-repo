import { Buffer } from 'node:buffer';
import { canReadMedia, parseMediaPath } from './media-authz';
import { asBody } from './bytes';
import {
  isThumbnailable,
  lookupThumbnail,
  parseThumbnailWidth,
  renderThumbnail,
  singleFlight,
  thumbnailKey,
  thumbnailVersion,
} from './media-thumbnail';

// ============================================================================
// Serving a media file from Nextcloud, once.
//
// There are fifteen media-read routes across the apps and each got a different
// subset of this right: one has range support, another has `nosniff`, a third
// has viewer authorization, a fourth caches private bytes as `public,
// immutable`. Every security fix so far has had to be applied by hand in eight
// places, and the last one reached five of them.
//
// This is the whole behaviour in one place. It deliberately replaces
// `createMediaGetHandler` in @elkdonis/blog-server — a package named after
// three throwaway draft sites, which are also its only three adopters, so the
// "proven shared factory" was proven by nothing that ships.
//
// Two deliberate shape choices:
//
//   1. It returns a standard `Response`, not a `NextResponse`. Next accepts
//      one from a route handler, so this package needs no `next` dependency
//      and stays usable outside a Next app.
//   2. It takes an already-resolved `viewerId` rather than reading the
//      session. Every app resolves identity differently (`getApiEditor`,
//      `getCurrentUser`, `getServerSession` with a `db_user_id` fallback), and
//      authorization inputs are exactly what a shared helper must not guess.
//      The AUTHORIZATION itself is here, because that part must be uniform.
// ============================================================================

const NEXTCLOUD_URL = () => process.env.NEXTCLOUD_URL || '';
const NEXTCLOUD_USER = () => process.env.NEXTCLOUD_ADMIN_USER || '';
const NEXTCLOUD_PASS = () => process.env.NEXTCLOUD_ADMIN_PASSWORD || '';

/** Each path segment encoded, but the separators kept. */
function encodeWebdavPath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/**
 * Types that are safe to render in the page. Everything else downloads —
 * an uploaded SVG, HTML or XML is a script container, and serving it inline
 * from the app's own origin is a stored-XSS delivery path.
 */
const INLINE_SAFE =
  /^(image\/(jpeg|png|gif|webp|avif|bmp|x-icon)|video\/|audio\/|application\/pdf|font\/)/;

const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
];

/**
 * Privacy is decided by the same parser that authorization uses. Deciding it
 * here with a separate `includes('/Private/')` test was case-SENSITIVE while
 * the authorization test is case-INsensitive, so a folder named `private/`
 * was gated correctly and then shipped to every shared cache as publicly
 * storable for a year.
 */
function isPrivatePath(filePath: string): boolean {
  return parseMediaPath(filePath)?.isPrivate ?? true;
}

function cacheControlFor(filePath: string): string {
  return isPrivatePath(filePath)
    ? 'private, no-store'
    : 'public, max-age=31536000, immutable';
}

/** Cache rule for derived images, matching the master's own privacy rule. */
function variantResponse(
  variant: { body: Buffer; contentType: string },
  filePath: string,
  key: string,
): Response {
  const headers = new Headers();
  headers.set('Content-Type', variant.contentType);
  headers.set('Content-Length', String(variant.body.byteLength));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Disposition', 'inline');
  headers.set('Cache-Control', cacheControlFor(filePath));
  // Derived bytes need their own validator; the master's would be wrong.
  headers.set('ETag', `W/"${key.slice(-32)}"`);
  return new Response(asBody(variant.body), { status: 200, headers });
}

/**
 * Serves a downscaled variant, or null to fall back to the master.
 *
 * Callable only after authorization has passed: the bytes are derived from a
 * file this viewer was already cleared to read, which is also why a cache
 * keyed on the file alone cannot leak — every read of it is preceded by the
 * same `canReadMedia` check for the same path.
 */
async function serveVariant(
  filePath: string,
  width: number,
  url: string,
  auth: string,
): Promise<Response | null> {
  let key: string;
  try {
    const head = await fetch(url, { method: 'HEAD', headers: { Authorization: `Basic ${auth}` } });
    if (!head.ok || !isThumbnailable(head.headers)) return null;
    key = thumbnailKey(filePath, width, thumbnailVersion(head.headers));
  } catch {
    return null;
  }

  // A hit is answered without ever pulling the master out of storage.
  const hit = await lookupThumbnail(key);
  if (hit) return variantResponse(hit, filePath, key);

  try {
    const rendered = await singleFlight(key, async () => {
      const source = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
      if (!source.ok) throw new Error(`upstream ${source.status}`);
      return renderThumbnail(filePath, width, key, source);
    });
    return variantResponse(rendered, filePath, key);
  } catch (err) {
    console.error(`[media-serve] variant failed for ${filePath}:`, err);
    return null;
  }
}

export interface ServeMediaOptions {
  /** Storage-relative path, e.g. `EAC_Network/<org>/Media/Images/x.png`. */
  filePath: string;
  /** Resolved by the caller. Null for an anonymous request. */
  viewerId: string | null;
  /**
   * Prefixes this route will serve. A single-org app passes its own folder so
   * its proxy cannot be used to read another org's files; omit to allow any
   * path `canReadMedia` accepts.
   */
  allowedPrefixes?: string[];
  /** Forwarded so seeking within audio and video works. */
  range?: string | null;
  /**
   * Serve a downscaled variant of this width instead of the master. Ignored
   * for ranged requests and for anything that is not a resizable image.
   */
  width?: number | null;
}

/**
 * Authorize, fetch and serve. Returns 404 for both "not found" and "not
 * allowed" — a media proxy that distinguishes them leaks which paths exist.
 */
export async function serveMedia(options: ServeMediaOptions): Promise<Response> {
  const { filePath, viewerId, allowedPrefixes, range, width } = options;

  if (!filePath || filePath.includes('..') || filePath.includes('\\')) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (allowedPrefixes?.length && !allowedPrefixes.some((p) => filePath.startsWith(p))) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!(await canReadMedia(viewerId, filePath))) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const baseUrl = NEXTCLOUD_URL();
  const user = NEXTCLOUD_USER();
  if (!baseUrl || !user) {
    console.error('[media-serve] Nextcloud is not configured');
    return new Response(JSON.stringify({ error: 'Storage unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const auth = Buffer.from(`${user}:${NEXTCLOUD_PASS()}`).toString('base64');
  const url = `${baseUrl}/remote.php/dav/files/${encodeURIComponent(user)}/${encodeWebdavPath(filePath)}`;

  // Re-snapped here rather than trusting the caller: this is the trust
  // boundary, and a route passing a raw query value must not be able to mint
  // unbounded cache keys.
  const variantWidth = parseThumbnailWidth(width ?? null);

  // The variant path runs its own fetch so that a failure mid-render can fall
  // through to serving the master below on a stream that was never touched.
  if (variantWidth && !range) {
    const variant = await serveVariant(filePath, variantWidth, url, auth);
    if (variant) return variant;
  }

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        ...(range ? { Range: range } : {}),
      },
    });
  } catch (err) {
    console.error(`[media-serve] fetch failed for ${filePath}:`, err);
    return new Response(JSON.stringify({ error: 'Storage unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = new Headers();
  for (const key of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }


  // A response whose visibility was just decided per-viewer must never be
  // stored by a shared cache: public+immutable would serve one org's private
  // file to the next requester for a year, so revoking access would not
  // revoke the leak.
  headers.set('Cache-Control', cacheControlFor(filePath));

  headers.set('X-Content-Type-Options', 'nosniff');
  const mediaType = (upstream.headers.get('content-type') ?? '').toLowerCase();
  headers.set('Content-Disposition', INLINE_SAFE.test(mediaType) ? 'inline' : 'attachment');

  return new Response(upstream.body, { status: upstream.status, headers });
}
