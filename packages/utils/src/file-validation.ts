/**
 * Magic-byte (file signature) validation for uploads.
 *
 * Upload routes previously trusted the client-supplied `File.type`, which is
 * trivially spoofed — an executable or HTML document can be sent with
 * `Content-Type: image/png`. This module sniffs the actual bytes and lets each
 * route verify that the content matches what the request claims to be.
 *
 * Notes:
 *  - SVG is intentionally classified as its own kind (`svg`), not `image`:
 *    SVGs can carry scripts and must not flow through raster-image pipelines.
 *  - `text/plain` has no signature; `looksLikeText` provides a heuristic for
 *    routes that accept plain-text documents.
 */

export type SniffedKind = 'image' | 'audio' | 'video' | 'document' | 'svg';

export interface SniffedType {
  mime: string;
  kind: SniffedKind;
}

function ascii(buf: Uint8Array, offset: number, text: string): boolean {
  if (buf.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (buf[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function bytes(buf: Uint8Array, offset: number, sig: number[]): boolean {
  if (buf.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[offset + i] !== sig[i]) return false;
  }
  return true;
}

/**
 * Identify a file's real type from its leading bytes.
 * Returns null when no known signature matches.
 */
export function sniffFileType(input: Uint8Array | ArrayBuffer): SniffedType | null {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (buf.length < 4) return null;

  // ── images ──
  if (bytes(buf, 0, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', kind: 'image' };
  if (bytes(buf, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: 'image/png', kind: 'image' };
  if (ascii(buf, 0, 'GIF8')) return { mime: 'image/gif', kind: 'image' };
  if (ascii(buf, 0, 'RIFF') && ascii(buf, 8, 'WEBP'))
    return { mime: 'image/webp', kind: 'image' };
  if (ascii(buf, 0, 'BM')) return { mime: 'image/bmp', kind: 'image' };
  if (ascii(buf, 4, 'ftypavif')) return { mime: 'image/avif', kind: 'image' };
  if (ascii(buf, 4, 'ftypheic') || ascii(buf, 4, 'ftypheix'))
    return { mime: 'image/heic', kind: 'image' };

  // ── svg (scriptable — its own kind on purpose) ──
  {
    const head = textHead(buf, 256).trimStart();
    if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg')))
      return { mime: 'image/svg+xml', kind: 'svg' };
  }

  // ── audio ──
  if (ascii(buf, 0, 'ID3')) return { mime: 'audio/mpeg', kind: 'audio' };
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0 && (buf[1] & 0x06) !== 0)
    return { mime: 'audio/mpeg', kind: 'audio' };
  if (ascii(buf, 0, 'OggS')) return { mime: 'audio/ogg', kind: 'audio' };
  if (ascii(buf, 0, 'fLaC')) return { mime: 'audio/flac', kind: 'audio' };
  if (ascii(buf, 0, 'RIFF') && ascii(buf, 8, 'WAVE'))
    return { mime: 'audio/wav', kind: 'audio' };
  if (ascii(buf, 4, 'ftypM4A')) return { mime: 'audio/mp4', kind: 'audio' };

  // ── video ──
  if (ascii(buf, 4, 'ftyp')) {
    // Generic ISO-BMFF container (mp4/mov/m4v); audio brand handled above.
    return { mime: 'video/mp4', kind: 'video' };
  }
  if (bytes(buf, 0, [0x1a, 0x45, 0xdf, 0xa3]))
    return { mime: 'video/webm', kind: 'video' }; // EBML (webm/mkv)
  if (ascii(buf, 0, 'RIFF') && ascii(buf, 8, 'AVI '))
    return { mime: 'video/x-msvideo', kind: 'video' };

  // ── documents ──
  if (ascii(buf, 0, '%PDF')) return { mime: 'application/pdf', kind: 'document' };
  if (bytes(buf, 0, [0x50, 0x4b, 0x03, 0x04]) || bytes(buf, 0, [0x50, 0x4b, 0x05, 0x06]))
    // ZIP container: zip itself or OOXML (docx/xlsx/pptx) — caller may trust
    // the declared OOXML mime for foldering; the container is what we verify.
    return { mime: 'application/zip', kind: 'document' };
  if (bytes(buf, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    return { mime: 'application/msword', kind: 'document' }; // legacy OLE office

  return null;
}

function textHead(buf: Uint8Array, n: number): string {
  let out = '';
  const len = Math.min(buf.length, n);
  for (let i = 0; i < len; i++) out += String.fromCharCode(buf[i]);
  return out;
}

/** Heuristic for signature-less plain text: no NUL bytes in the first 1 KiB. */
export function looksLikeText(input: Uint8Array | ArrayBuffer): boolean {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  const len = Math.min(buf.length, 1024);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return false;
  }
  return len > 0;
}

export type UploadValidation =
  | { ok: true; sniffed: SniffedType }
  | { ok: false; reason: string };

/**
 * Validate an upload buffer against the kinds a route accepts.
 *
 * `allowText: true` additionally accepts signature-less plain text as a
 * `document` (for routes that allow text/plain).
 */
export function validateUploadBuffer(
  input: Uint8Array | ArrayBuffer,
  allowedKinds: SniffedKind[],
  opts: { allowText?: boolean } = {}
): UploadValidation {
  const sniffed = sniffFileType(input);

  if (!sniffed) {
    if (opts.allowText && allowedKinds.includes('document') && looksLikeText(input)) {
      return { ok: true, sniffed: { mime: 'text/plain', kind: 'document' } };
    }
    return { ok: false, reason: 'Unrecognized file content' };
  }

  if (!allowedKinds.includes(sniffed.kind)) {
    return {
      ok: false,
      reason: `File content is ${sniffed.mime}, which is not allowed here`,
    };
  }

  return { ok: true, sniffed };
}
