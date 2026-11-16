/**
 * The one image re-encode step for uploads (2026-11-16).
 *
 * Lifted from apps/elktours/src/lib/assets.ts `stripImageMetadata`, plus an
 * optional long-edge resize. A re-encode drops EXIF (GPS, camera, owner) and
 * anything smuggled into trailing bytes or metadata blocks, and makes the
 * stored bytes a file our own encoder produced.
 *
 * Kept as-is, never re-encoded: animated GIF and animated WebP (a re-encode
 * would flatten them). Refused with a message a person can act on: HEIC.
 */
import { Buffer } from 'node:buffer';

export class UploadRefusal extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const HEIC_MESSAGE = 'HEIC photo: please send a JPEG (on a phone, set the camera to "Most Compatible").';
const MAX_PIXELS = 100_000_000;
/** JPEG/WebP quality when a policy does not ask for more (avatars, forum). */
export const DEFAULT_QUALITY = 88;

export interface ProcessedImage {
  data: Uint8Array;
  mime: string;
  ext: string;
  width?: number;
  height?: number;
  /** true when the bytes were re-encoded (false for animated GIF/WebP kept as sent) */
  reencoded: boolean;
}

export function isHeicBytes(buf: Uint8Array): boolean {
  if (buf.length < 12) return false;
  const box = String.fromCharCode(...buf.subarray(4, 12));
  return box.startsWith('ftyp') && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|heif)$/.test(box.slice(4, 8));
}

export async function processImage(
  input: Uint8Array,
  opts: { maxEdge?: number; quality?: number } = {}
): Promise<ProcessedImage> {
  const quality = opts.quality ?? DEFAULT_QUALITY;
  if (isHeicBytes(input)) throw new UploadRefusal(415, HEIC_MESSAGE);
  const sharp = (await import('sharp')).default;
  const buf = Buffer.from(input);
  try {
    const meta = await sharp(buf, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata();
    const animated = (meta.pages ?? 1) > 1;
    if (animated && (meta.format === 'gif' || meta.format === 'webp')) {
      return {
        data: input,
        mime: meta.format === 'gif' ? 'image/gif' : 'image/webp',
        ext: meta.format === 'gif' ? 'gif' : 'webp',
        width: meta.width,
        height: meta.pageHeight ?? meta.height,
        reencoded: false,
      };
    }
    let img = sharp(buf, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).rotate();
    if (opts.maxEdge) {
      img = img.resize({ width: opts.maxEdge, height: opts.maxEdge, fit: 'inside', withoutEnlargement: true });
    }
    let data: Buffer;
    let mime: string;
    let ext: string;
    if (meta.format === 'png') {
      data = await img.png().toBuffer();
      mime = 'image/png';
      ext = 'png';
    } else if (meta.format === 'webp') {
      data = await img.webp({ quality }).toBuffer();
      mime = 'image/webp';
      ext = 'webp';
    } else if (meta.format === 'gif') {
      // a still GIF: PNG keeps it lossless
      data = await img.png().toBuffer();
      mime = 'image/png';
      ext = 'png';
    } else {
      data = await img.jpeg({ quality, mozjpeg: true }).toBuffer();
      mime = 'image/jpeg';
      ext = 'jpg';
    }
    // sharp drops metadata unless asked to keep it; confirm rather than assume.
    const out = await sharp(data).metadata();
    if (out.exif) throw new UploadRefusal(422, 'Could not remove the metadata from this photo, so it was not stored.');
    return { data, mime, ext, width: out.width, height: out.height, reencoded: true };
  } catch (err) {
    if (err instanceof UploadRefusal) throw err;
    console.error('[uploads] image re-encode:', (err as Error).message);
    throw new UploadRefusal(422, 'That picture could not be read. Try a JPEG or PNG.');
  }
}
