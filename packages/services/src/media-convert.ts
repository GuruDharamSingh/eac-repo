import { Buffer } from 'node:buffer';
import { canReadMedia } from './media-authz';

// ============================================================================
// A stored picture, resized and converted, for the Studio's image tools
// (2026-11-01). The editor opens big photos through this at a working size
// (a phone does not decode 24 megapixels well), and the Post kind turns a
// PNG or WebP into the JPEG Instagram needs. Read-only: the edited or
// converted picture is saved through the app's ordinary upload route.
//
// Same trust rules as media-thumbnail.ts: a closed set of sizes and formats,
// a ceiling on bytes and pixels decoded, the viewer checked with
// canReadMedia. Not cached: each call is one person's working copy.
// ============================================================================

export const CONVERT_SIZES = [1080, 2048, 4096] as const;
export type ConvertFormat = 'jpeg' | 'png' | 'webp';
const TYPES: Record<ConvertFormat, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const SOURCE = /^image\/(jpeg|png|webp|avif|tiff|heic|heif)$/;
const MAX_SOURCE_BYTES = 60 * 1024 * 1024;
const MAX_INPUT_PIXELS = 80_000_000;

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } });

export interface ConvertMediaOptions {
  filePath: string;
  viewerId: string | null;
  /** Longest edge wanted; snapped up to a CONVERT_SIZES entry, never enlarged. */
  max?: number | string | null;
  format?: string | null;
  allowedPrefixes?: string[];
}

export async function convertMediaImage(o: ConvertMediaOptions): Promise<Response> {
  const { filePath, viewerId } = o;
  if (!viewerId) return json(401, 'Sign in');
  if (!filePath || filePath.includes('..') || filePath.includes('\\')) return json(404, 'Not found');
  if (o.allowedPrefixes?.length && !o.allowedPrefixes.some((p) => filePath.startsWith(p))) return json(404, 'Not found');
  if (!(await canReadMedia(viewerId, filePath))) return json(404, 'Not found');

  const wanted = Number(o.max) || 2048;
  const size = CONVERT_SIZES.find((s) => s >= wanted) ?? CONVERT_SIZES[CONVERT_SIZES.length - 1];
  const format: ConvertFormat = o.format === 'png' || o.format === 'webp' ? o.format : 'jpeg';

  const base = process.env.NEXTCLOUD_URL || '';
  const user = process.env.NEXTCLOUD_ADMIN_USER || '';
  if (!base || !user) return json(503, 'Storage unavailable');
  const auth = Buffer.from(`${user}:${process.env.NEXTCLOUD_ADMIN_PASSWORD || ''}`).toString('base64');
  const url = `${base}/remote.php/dav/files/${encodeURIComponent(user)}/${filePath.split('/').map(encodeURIComponent).join('/')}`;

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  } catch {
    return json(502, 'Storage unavailable');
  }
  if (!upstream.ok) return json(404, 'Not found');
  const type = (upstream.headers.get('content-type') ?? '').toLowerCase().split(';')[0] ?? '';
  if (!SOURCE.test(type)) return json(415, 'Not a picture this can convert');
  const length = Number(upstream.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_SOURCE_BYTES) return json(413, 'Picture too large');
  const source = Buffer.from(await upstream.arrayBuffer());
  if (source.length > MAX_SOURCE_BYTES) return json(413, 'Picture too large');

  try {
    const sharp = (await import('sharp')).default;
    // rotate() applies the EXIF orientation; sharp writes no metadata unless asked,
    // so camera details and GPS position are dropped.
    let img = sharp(source, { limitInputPixels: MAX_INPUT_PIXELS }).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true });
    img = format === 'jpeg' ? img.flatten({ background: '#ffffff' }).jpeg({ quality: 88, mozjpeg: true }) : format === 'png' ? img.png() : img.webp({ quality: 86 });
    const body = await img.toBuffer();
    return new Response(new Uint8Array(body), {
      headers: { 'Content-Type': TYPES[format], 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (err) {
    console.error(`[media-convert] failed for ${filePath}:`, err);
    return json(422, 'Could not read this picture');
  }
}
