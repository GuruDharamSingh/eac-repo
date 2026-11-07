// CONTRACT: photo helpers (server only): sniff, EXIF geo read, private store. Used by custom-place-actions and suggestion-actions.
import { randomBytes } from "node:crypto";
import { uploadFile } from "@elkdonis/services";
import { isHeic } from "@/lib/assets";
import { siteConfig } from "@/config/site";
import type { PhotoGeo } from "@/lib/catalogue-types";

const ORG = siteConfig.orgId;
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

export type SniffedImage = { ext: string; mime: string } | null;

export function sniffImage(b: Buffer): SniffedImage {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return { ext: "webp", mime: "image/webp" };
  if (isHeic(b)) return { ext: "heic", mime: "image/heic" };
  return null;
}

/** EXIF location, direction, time, altitude (exifr). 0,0 counts as no fix. */
export async function readPhotoGeo(buf: Buffer): Promise<PhotoGeo> {
  const exifr = (await import("exifr")).default;
  const tags = (await exifr
    .parse(buf, { gps: true, exif: true, tiff: true, xmp: false, icc: false, iptc: false, translateValues: true, reviveValues: true })
    .catch(() => null)) as Record<string, unknown> | null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  let lat = num(tags?.latitude);
  let lng = num(tags?.longitude);
  if (lat != null && lng != null && Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) lat = lng = null;
  const dir = num(tags?.GPSImgDirection);
  const when = (tags?.DateTimeOriginal ?? tags?.CreateDate) as unknown;
  return {
    lat,
    lng,
    direction: dir != null ? ((dir % 360) + 360) % 360 : null,
    takenAt: when instanceof Date && !Number.isNaN(when.getTime()) ? when.toISOString() : null,
    altitudeM: num(tags?.GPSAltitude),
  };
}

/** Store the untouched original under Private/ with a neutral name. Null on storage failure. */
export async function storePrivatePhoto(buf: Buffer, kind: { ext: string; mime: string }, prefix = "place-photo"): Promise<string | null> {
  const key = `EAC_Network/${ORG}/Private/Media/Images/${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.${kind.ext}`;
  return (await uploadFile(key, buf, kind.mime)) ? key : null;
}

/** Pixel size after EXIF orientation; nulls for HEIC or unreadable files. */
export async function photoSize(buf: Buffer, ext: string): Promise<{ width: number | null; height: number | null }> {
  if (ext === "heic") return { width: null, height: null };
  try {
    const sharp = (await import("sharp")).default;
    const m = await sharp(buf).metadata();
    const swap = (m.orientation ?? 1) >= 5;
    return { width: (swap ? m.height : m.width) ?? null, height: (swap ? m.width : m.height) ?? null };
  } catch {
    return { width: null, height: null };
  }
}
