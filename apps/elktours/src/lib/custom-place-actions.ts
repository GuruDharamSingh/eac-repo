"use server";
// CONTRACT: custom locations (editor-only): place from a map pin or a geotagged photo. Types in lib/catalogue-types.ts.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@elkdonis/db";
import { sanitizeRichText } from "@elkdonis/utils";
import { requireOrgEditor } from "@/lib/auth";
import { getAsset, mapAsset } from "@/lib/assets";
import { MAX_PHOTO_BYTES, photoSize, readPhotoGeo, sniffImage, storePrivatePhoto } from "@/lib/photo-geo";
import { getPlace, mapPlace, stopDraftFromPlace, uniquePlaceSlug } from "@/lib/places";
import { reverseGeocode } from "@/lib/suggest";
import { siteConfig } from "@/config/site";
import type { PhotoGeo, PhotoPlaceResult, PinPlaceInput, Place, ReverseGeocode, Result, StopDraft, TourAsset } from "@/lib/catalogue-types";

/**
 * Custom locations. An editor makes a catalogue place (and, in the tour builder, a stop
 * draft from it) by dropping a pin or uploading a geotagged photo.
 *
 *   - Pin: title/address come from the input, else Photon reverse geocoding (OSM credit
 *     returned with it). The editor can override both.
 *   - Photo: EXIF GPS (lat/lng), GPSImgDirection (-> Street View heading) and the time it
 *     was taken are read with exifr. The ORIGINAL is stored privately
 *     (EAC_Network/elktours/Private/Media/Images/) as a hidden place asset. Any public copy
 *     is re-encoded without EXIF (lib/assets.ts stripImageMetadata), so GPS never leaks.
 *   - No GPS and no pin: the photo is kept as a pending asset (source 'photo_pending',
 *     migration 237) and the result says needsPin; attachPhotoToPinAction finishes it.
 *   - HEIC (iPhone): GPS is read and the original kept; it cannot be made public until a
 *     JPEG is uploaded (this server cannot decode HEVC). The message says so.
 */

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f-]{36}$/i;
const MAX_BYTES = MAX_PHOTO_BYTES;

const pinSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  title: z.string().trim().max(200).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  body: z.string().max(100_000).nullable().optional(),
  privateNotes: z.string().max(100_000).nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(30).optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  pitch: z.number().min(-90).max(90).nullable().optional(),
  fov: z.number().min(10).max(100).nullable().optional(),
});

/** Create the place; reverse-geocode only for what the editor left empty. */
async function insertPinPlace(pin: z.infer<typeof pinSchema>, userId: string): Promise<{ place: Place; reverse: ReverseGeocode | null }> {
  const needLookup = !pin.title?.trim() || !pin.address?.trim();
  const reverse = needLookup ? await reverseGeocode(pin.lat, pin.lng) : null;
  const title = (pin.title?.trim() || reverse?.title || reverse?.address || `Pin ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`).slice(0, 200);
  const address = pin.address?.trim() || reverse?.address || null;
  const slug = await uniquePlaceSlug(title);
  const tags = [...new Set(pin.tags ?? (reverse?.category ? [reverse.category.replace(/_/g, " ")] : []))];
  const [r] = (await db`
    INSERT INTO places (org_id, slug, title, body, private_notes, lat, lng, heading, pitch, fov, address, tags, source, source_ref, created_by)
    VALUES (${ORG}, ${slug}, ${title}, ${pin.body ? sanitizeRichText(pin.body) || null : null},
            ${pin.privateNotes ? sanitizeRichText(pin.privateNotes) || null : null},
            ${pin.lat}, ${pin.lng}, ${pin.heading ?? null}, ${pin.pitch ?? null}, ${pin.fov ?? null},
            ${address}, ${tags}::text[], 'manual', ${!pin.title?.trim() ? (reverse?.sourceRef ?? null) : null}, ${userId})
    RETURNING *
  `) as unknown as Row[];
  return { place: mapPlace(r!), reverse };
}

export async function reverseGeocodeAction(lat: number, lng: number): Promise<ReverseGeocode | null> {
  await requireOrgEditor();
  return reverseGeocode(Number(lat), Number(lng));
}

export async function createPlaceFromPin(input: PinPlaceInput): Promise<Result<{ place: Place; stop: StopDraft; reverse: ReverseGeocode | null }>> {
  const viewer = await requireOrgEditor();
  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Drop the pin on the map first." };
  try {
    const { place, reverse } = await insertPinPlace(parsed.data, viewer.userId);
    revalidatePath("/manage/places");
    return { ok: true, place, stop: stopDraftFromPlace(place), reverse };
  } catch (err) {
    console.error("[elktours] createPlaceFromPin:", err);
    return { ok: false, error: "Could not create the place." };
  }
}

function formNumber(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * FormData: `file` (jpeg/png/webp/heic/heif, <= 25 MB), optional `title`, optional `lat`+`lng` (a pin that overrides the geotag).
 * Stores the original privately as a place asset (kind image, hidden); public copies are EXIF-stripped.
 * No GPS and no pin -> { needsPin: true, assetId }.
 */
export async function createPlaceFromPhoto(formData: FormData): Promise<PhotoPlaceResult> {
  const viewer = await requireOrgEditor();
  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) return { ok: false, error: "Choose a photo." };
  if (file.size > MAX_BYTES) return { ok: false, error: "That photo is over 25 MB." };
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) return { ok: false, error: "That file is not a JPEG, PNG, WebP or HEIC photo." };

  const geo = await readPhotoGeo(buf);
  const pinLat = formNumber(formData.get("lat"));
  const pinLng = formNumber(formData.get("lng"));
  const pinned = pinLat != null && pinLng != null && Math.abs(pinLat) <= 90 && Math.abs(pinLng) <= 180;
  const lat = pinned ? pinLat : geo.lat;
  const lng = pinned ? pinLng : geo.lng;
  const title = typeof formData.get("title") === "string" ? String(formData.get("title")).trim().slice(0, 200) : "";

  // Original, untouched, private. Name carries no title or location.
  const key = await storePrivatePhoto(buf, kind);
  if (!key) return { ok: false, error: "Could not store the photo. Try again." };
  const { width, height } = await photoSize(buf, kind.ext);
  const meta = {
    exif: geo,
    pinnedBy: pinned ? "editor" : geo.lat != null ? "exif" : null,
    originalName: typeof (file as File).name === "string" ? (file as File).name.slice(0, 200) : null,
    heic: kind.ext === "heic",
  };

  try {
    if (lat == null || lng == null) {
      const [r] = (await db`
        INSERT INTO tour_assets (org_id, kind, role, storage, storage_key, url, mime_type, bytes, width, height, source,
                                 visible, caption, meta, created_by)
        VALUES (${ORG}, 'image', 'gallery', 'nextcloud', ${key}, ${`/api/media/${key}`}, ${kind.mime}, ${buf.length}, ${width}, ${height},
                'photo_pending', false, ${title || null}, ${db.json(meta as never)}, ${viewer.userId})
        RETURNING *
      `) as unknown as Row[];
      const asset = mapAsset(r!);
      return { ok: true, needsPin: true, assetId: asset.id, asset, geo };
    }
    const { place, reverse } = await insertPinPlace({ lat, lng, title: title || null, heading: geo.direction }, viewer.userId);
    const [r] = (await db`
      INSERT INTO tour_assets (org_id, place_id, kind, role, storage, storage_key, url, mime_type, bytes, width, height, source,
                               visible, caption, meta, created_by)
      VALUES (${ORG}, ${place.id}, 'image', 'gallery', 'nextcloud', ${key}, ${`/api/media/${key}`}, ${kind.mime}, ${buf.length}, ${width}, ${height},
              'photo', false, ${title || null}, ${db.json(meta as never)}, ${viewer.userId})
      RETURNING *
    `) as unknown as Row[];
    revalidatePath("/manage/places");
    const fresh = (await getPlace(place.id)) ?? place;
    return { ok: true, needsPin: false, place: fresh, stop: stopDraftFromPlace(fresh), asset: mapAsset(r!), geo, reverse };
  } catch (err) {
    console.error("[elktours] createPlaceFromPhoto:", err);
    return { ok: false, error: "Could not create the place from this photo." };
  }
}

/** Finish a needsPin upload: create the place at the pin and attach the kept photo to it. */
export async function attachPhotoToPinAction(assetId: string, pin: PinPlaceInput): Promise<Result<{ place: Place; stop: StopDraft; asset: TourAsset }>> {
  const viewer = await requireOrgEditor();
  if (!UUID.test(assetId)) return { ok: false, error: "Photo not found." };
  const parsed = pinSchema.safeParse(pin);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Drop the pin on the map first." };
  const pending = await getAsset(assetId);
  if (!pending || pending.source !== "photo_pending" || pending.archivedAt) return { ok: false, error: "That photo is no longer waiting for a pin." };
  try {
    const exif = (pending.meta.exif ?? {}) as Partial<PhotoGeo>;
    const { place } = await insertPinPlace(
      { ...parsed.data, title: parsed.data.title || pending.caption, heading: parsed.data.heading ?? exif.direction ?? null },
      viewer.userId
    );
    const [r] = (await db`
      UPDATE tour_assets SET place_id = ${place.id}, source = 'photo',
        meta = meta || ${db.json({ pinnedBy: "editor" })}, updated_at = NOW()
      WHERE id = ${assetId} AND org_id = ${ORG} AND source = 'photo_pending'
      RETURNING *
    `) as unknown as Row[];
    if (!r) return { ok: false, error: "That photo is no longer waiting for a pin." };
    revalidatePath("/manage/places");
    const fresh = (await getPlace(place.id)) ?? place;
    return { ok: true, place: fresh, stop: stopDraftFromPlace(fresh), asset: mapAsset(r) };
  } catch (err) {
    console.error("[elktours] attachPhotoToPinAction:", err);
    return { ok: false, error: "Could not create the place." };
  }
}

/** Drop a pending (unpinned) photo: archived; the private file stays in storage. */
export async function discardPendingPhotoAction(assetId: string): Promise<Result> {
  await requireOrgEditor();
  if (!UUID.test(assetId)) return { ok: false, error: "Photo not found." };
  await db`
    UPDATE tour_assets SET archived_at = NOW(), updated_at = NOW()
    WHERE id = ${assetId} AND org_id = ${ORG} AND source = 'photo_pending'
  `;
  return { ok: true };
}
