import { createHash } from 'node:crypto';

// ============================================================================
// Downscaled variants of stored images.
//
// Originals in the network's storage are gallery masters — several thousand
// pixels wide and often multiple megabytes. Every surface that shows them as a
// thumbnail, a card, a texture or an avatar was previously sending the master
// down the wire and letting the browser shrink it, which costs the visitor the
// full download and the device the full decode.
//
// Rendering is reachable by anonymous visitors (any non-private path is), so
// everything here is written against an untrusted caller: a closed set of
// widths, a hard ceiling on bytes AND pixels decoded, and one render per key
// at a time no matter how many requests arrive together.
// ============================================================================

/** Offered widths. A closed set, so the cache cannot be blown up on request. */
export const THUMBNAIL_WIDTHS = [128, 256, 512, 1024] as const;

/** Formats sharp can usefully resize. GIF and SVG deliberately pass through. */
export const THUMBNAILABLE = /^image\/(jpeg|png|webp|avif|tiff)$/;

const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
/** Guards decompression bombs: sharp's own default allows ~268MP. */
const MAX_INPUT_PIXELS = 50_000_000;
const MAX_CACHED_BYTES = 1024 * 1024;
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
/** The cache is an optimisation; it must never add latency to a media read. */
const CACHE_OP_TIMEOUT_MS = 200;

export interface ThumbnailResult {
  body: Buffer;
  contentType: string;
}

/** Raised when the source could not be read; the caller must not reuse it. */
export class ThumbnailSourceError extends Error {}

/**
 * Resolves `?w=` to an offered width, snapping anything else up to the next
 * one so arbitrary values cannot each mint their own cache entry.
 */
export function parseThumbnailWidth(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const requested = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
  if (!Number.isFinite(requested) || requested <= 0) return null;
  return THUMBNAIL_WIDTHS.find((w) => w >= requested) ?? THUMBNAIL_WIDTHS[THUMBNAIL_WIDTHS.length - 1];
}

export function isThumbnailable(headers: Headers): boolean {
  const contentType = (headers.get('content-type') ?? '').toLowerCase().split(';')[0] ?? '';
  if (!THUMBNAILABLE.test(contentType)) return false;

  const declaredLength = Number.parseInt(headers.get('content-length') ?? '', 10);
  return !(Number.isFinite(declaredLength) && declaredLength > MAX_SOURCE_BYTES);
}

/**
 * Identifies the stored bytes. Derived once from the HEAD and reused for the
 * render, so a validator that differs between HEAD and GET cannot produce a
 * key that is written but never read.
 */
export function thumbnailVersion(headers: Headers): string {
  return (
    headers.get('etag') ??
    `${headers.get('last-modified') ?? ''}:${headers.get('content-length') ?? ''}`
  );
}

/** Hashed rather than concatenated, so no component can forge a separator. */
export function thumbnailKey(filePath: string, width: number, version: string): string {
  const digest = createHash('sha256').update(version).update('\0').update(filePath).digest('hex');
  return `media:thumb:v2:${width}:${digest}`;
}

async function withTimeout<T>(work: Promise<T>): Promise<T | null> {
  return Promise.race([
    work,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), CACHE_OP_TIMEOUT_MS)),
  ]).catch(() => null);
}

export async function lookupThumbnail(key: string): Promise<ThumbnailResult | null> {
  const cached = await withTimeout(
    (async () => {
      const { getRedisClient } = await import('@elkdonis/redis');
      return getRedisClient().getBuffer(key);
    })(),
  );
  return cached ? { body: cached, contentType: 'image/webp' } : null;
}

async function cacheThumbnail(key: string, value: Buffer): Promise<void> {
  if (value.byteLength > MAX_CACHED_BYTES) return;
  await withTimeout(
    (async () => {
      const { getRedisClient } = await import('@elkdonis/redis');
      await getRedisClient().set(key, value, 'EX', CACHE_TTL_SECONDS);
      return true;
    })(),
  );
}

/**
 * Reads at most `MAX_SOURCE_BYTES`. A `content-length` may be absent or a lie,
 * so the ceiling is enforced against the bytes actually delivered.
 */
async function readCapped(response: globalThis.Response): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new ThumbnailSourceError('no body');

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new ThumbnailSourceError('source exceeds cap');
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks, total);
}

const inFlight = new Map<string, Promise<ThumbnailResult>>();

/**
 * One render per key at a time. Without this, N simultaneous requests for the
 * same cold thumbnail each download the master and each run a full decode.
 */
export function singleFlight(
  key: string,
  work: () => Promise<ThumbnailResult>,
): Promise<ThumbnailResult> {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const started = work().finally(() => inFlight.delete(key));
  inFlight.set(key, started);
  return started;
}

/**
 * Renders and caches a variant. Throws `ThumbnailSourceError` if the source
 * could not be read — the response body is consumed here either way, so the
 * caller must not fall back to streaming it.
 */
export async function renderThumbnail(
  filePath: string,
  width: number,
  key: string,
  upstream: globalThis.Response,
): Promise<ThumbnailResult> {
  const contentType =
    (upstream.headers.get('content-type') ?? '').toLowerCase().split(';')[0] ?? '';

  const source = await readCapped(upstream);

  try {
    const sharp = (await import('sharp')).default;
    const body = await sharp(source, { limitInputPixels: MAX_INPUT_PIXELS })
      // Honours EXIF orientation, which phone photos rely on.
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    await cacheThumbnail(key, body);
    return { body, contentType: 'image/webp' };
  } catch (err) {
    console.error(`[media-thumbnail] resize failed for ${filePath}:`, err);
    // Serve the master we already hold rather than failing the request.
    return { body: source, contentType };
  }
}
