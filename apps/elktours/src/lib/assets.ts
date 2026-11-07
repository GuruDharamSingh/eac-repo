// CONTRACT: tour/stop/place/experience asset registry (server only). Types in lib/catalogue-types.ts.
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import type { AssetInput, AssetKind, AssetScope, PublicTourAssets, TourAsset } from "@/lib/catalogue-types";

/**
 * tour_assets (migrations 233 + 235): one row per file or live feature a tour
 * page can show, each with its own `visible` switch. Public reads use
 * `visible AND archived_at IS NULL` only.
 *
 * `threads.metadata.film` stays the cache of the visible hero film: every
 * change to which film is the visible hero rewrites it in the same
 * transaction (writeFilmCache), so cards and pages that read metadata.film
 * keep working.
 *
 * Files under `EAC_Network/elktours/Private/` are never served publicly.
 * Making one visible copies it to the matching public `Media/` path first.
 */

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
type Tx = typeof db;

const KINDS: AssetKind[] = ["film", "poster", "image", "still", "map3d", "streetview", "document"];
const LIVE: AssetKind[] = ["map3d", "streetview"];
const MEDIA_PREFIX = `/api/media/EAC_Network/${ORG}/`;
const UUID = /^[0-9a-f-]{36}$/i;

const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());
const num = (v: unknown): number | null => (v == null ? null : Number(v));

export function mapAsset(r: Row): TourAsset {
  const key = (r.storage_key as string | null) ?? null;
  return {
    id: r.id as string,
    orgId: r.org_id as string,
    threadId: (r.thread_id as string | null) ?? null,
    stopId: (r.stop_id as string | null) ?? null,
    placeId: (r.place_id as string | null) ?? null,
    kind: r.kind as AssetKind,
    role: (r.role as string | null) ?? null,
    variant: (r.variant as string | null) ?? null,
    storage: (r.storage as "nextcloud" | "external") ?? "nextcloud",
    storageKey: key,
    url: (r.url as string | null) ?? null,
    mimeType: (r.mime_type as string | null) ?? null,
    bytes: num(r.bytes),
    width: num(r.width),
    height: num(r.height),
    seconds: num(r.seconds),
    sha256: (r.sha256 as string | null) ?? null,
    source: r.source as string,
    attribution: (r.attribution as string | null) ?? null,
    licenceNote: (r.licence_note as string | null) ?? null,
    visible: Boolean(r.visible),
    isPrivateFile: isPrivateKey(key) || isPrivateKey(urlKey((r.url as string | null) ?? null)),
    position: Number(r.position ?? 0),
    caption: (r.caption as string | null) ?? null,
    altText: (r.alt_text as string | null) ?? null,
    meta: (r.meta as Record<string, unknown> | null) ?? {},
    renderRequestId: (r.render_request_id as string | null) ?? null,
    createdBy: (r.created_by as string | null) ?? null,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
    archivedAt: iso(r.archived_at),
  };
}

/** `/api/media/<key>` → `<key>`. */
export function urlKey(url: string | null): string | null {
  return url && url.startsWith("/api/media/") ? decodeURI(url.slice("/api/media/".length)) : null;
}
function isPrivateKey(key: string | null): boolean {
  return !!key && key.startsWith(`EAC_Network/${ORG}/Private/`);
}

/** Only our own media route or an external https URL. */
export function acceptableUrl(url: string): boolean {
  if (url.startsWith(MEDIA_PREFIX)) return !url.includes("..");
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

// ── reads ────────────────────────────────────────────────────────────────

export async function listAssets(scope: AssetScope): Promise<TourAsset[]> {
  const archived = scope.includeArchived ? db`` : db`AND a.archived_at IS NULL`;
  try {
    let rows: Row[];
    if ("threadId" in scope) {
      rows = (await db`
        SELECT a.* FROM tour_assets a
        LEFT JOIN tour_stops s ON s.id = a.stop_id
        WHERE a.org_id = ${ORG} AND a.thread_id = ${scope.threadId}
          ${scope.includeStops === false ? db`AND a.stop_id IS NULL` : db``}
          ${archived}
        ORDER BY a.stop_id IS NOT NULL, s.position NULLS FIRST, a.kind, a.position, a.variant NULLS FIRST, a.created_at DESC
      `) as unknown as Row[];
    } else if ("stopId" in scope) {
      if (!UUID.test(scope.stopId)) return [];
      rows = (await db`
        SELECT a.* FROM tour_assets a
        WHERE a.org_id = ${ORG} AND a.stop_id = ${scope.stopId} ${archived}
        ORDER BY a.kind, a.position, a.created_at DESC
      `) as unknown as Row[];
    } else {
      if (!UUID.test(scope.placeId)) return [];
      rows = (await db`
        SELECT a.* FROM tour_assets a
        WHERE a.org_id = ${ORG} AND a.place_id = ${scope.placeId} AND a.thread_id IS NULL ${archived}
        ORDER BY a.kind, a.position, a.created_at DESC
      `) as unknown as Row[];
    }
    return rows.map(mapAsset);
  } catch (err) {
    console.error("[elktours] listAssets:", err);
    return [];
  }
}

export async function getAsset(id: string): Promise<TourAsset | null> {
  if (!UUID.test(id)) return null;
  const [r] = (await db`SELECT * FROM tour_assets WHERE id = ${id} AND org_id = ${ORG}`) as unknown as Row[];
  return r ? mapAsset(r) : null;
}

const EMPTY_PUBLIC: PublicTourAssets = { film: null, poster: null, map3d: true, streetview: {}, stills: {}, stopImages: {}, images: [] };

/**
 * What a public tour page may show. Visible and not archived only; a live
 * switch with no row counts as on, so tours and stops made after the
 * backfill behave as before until someone switches something off.
 */
export async function publicTourAssets(threadId: string): Promise<PublicTourAssets> {
  try {
    const [rows, stops, threads] = await Promise.all([
      db`SELECT * FROM tour_assets WHERE org_id = ${ORG} AND thread_id = ${threadId} AND archived_at IS NULL
         ORDER BY position, created_at` as unknown as Promise<Row[]>,
      db`SELECT id, still_url FROM tour_stops WHERE thread_id = ${threadId} AND org_id = ${ORG}` as unknown as Promise<Row[]>,
      db`SELECT metadata->'film' AS film FROM threads WHERE id = ${threadId} AND org_id = ${ORG}` as unknown as Promise<Row[]>,
    ]);
    const all = rows.map(mapAsset);
    const vis = all.filter((a) => a.visible && !a.isPrivateFile);
    const out: PublicTourAssets = { film: null, poster: null, map3d: true, streetview: {}, stills: {}, stopImages: {}, images: [] };

    const hero = vis.find((a) => a.kind === "film" && !a.stopId && a.role === "hero" && a.variant === "1080" && a.url);
    if (hero) {
      const sib = (pred: (a: TourAsset) => boolean) =>
        vis.find((a) => pred(a) && (hero.renderRequestId ? a.renderRequestId === hero.renderRequestId : a.role === "hero"));
      const url720 = sib((a) => a.kind === "film" && a.variant === "720" && !a.stopId)?.url ?? null;
      const poster = sib((a) => a.kind === "poster" && !a.stopId)?.url ?? null;
      out.film = { url: hero.url!, url720, poster, seconds: hero.seconds, assetId: hero.id, attribution: hero.attribution };
    } else if (!all.some((a) => a.kind === "film" && !a.stopId)) {
      // A tour with no film rows at all (e.g. a film set before migration 233): fall back to the cache.
      const f = threads[0]?.film as { url?: string; url720?: string; poster?: string; seconds?: number } | null | undefined;
      if (f?.url) out.film = { url: f.url, url720: f.url720 ?? null, poster: f.poster ?? null, seconds: f.seconds ?? null, assetId: "", attribution: "Google, Cesium" };
    }
    out.poster = vis.find((a) => a.kind === "poster" && !a.stopId && a.url)?.url ?? out.film?.poster ?? null;

    const map3d = all.filter((a) => a.kind === "map3d" && !a.stopId);
    if (map3d.length > 0) out.map3d = map3d.some((a) => a.visible);

    for (const s of stops) {
      const stopId = s.id as string;
      const sv = all.filter((a) => a.kind === "streetview" && a.stopId === stopId);
      out.streetview[stopId] = sv.length === 0 || sv.some((a) => a.visible);
      const stillRows = all.filter((a) => a.kind === "still" && a.stopId === stopId && a.url);
      const visibleStill = stillRows.find((a) => a.visible && !a.isPrivateFile);
      const still = s.still_url as string | null;
      if (visibleStill) out.stills[stopId] = visibleStill.url!;
      else if (still && !stillRows.some((a) => a.url === still)) out.stills[stopId] = still;
    }
    for (const a of vis) {
      if (a.kind !== "image" || !a.url) continue;
      const item = { url: a.url, caption: a.caption, altText: a.altText, attribution: a.attribution };
      if (a.stopId) (out.stopImages[a.stopId] ??= []).push(item);
      else out.images.push(item);
    }
    return out;
  } catch (err) {
    console.error(`[elktours] publicTourAssets(${threadId}):`, err);
    return { ...EMPTY_PUBLIC, streetview: {}, stills: {}, stopImages: {}, images: [] };
  }
}

// ── writes ───────────────────────────────────────────────────────────────

async function assertOwners(input: { threadId?: string | null; stopId?: string | null; placeId?: string | null }): Promise<{ threadId: string | null; stopId: string | null; placeId: string | null }> {
  let threadId = input.threadId ?? null;
  const stopId = input.stopId ?? null;
  const placeId = input.placeId ?? null;
  if (stopId) {
    if (!UUID.test(stopId)) throw new Error("Unknown stop.");
    const [s] = (await db`SELECT thread_id FROM tour_stops WHERE id = ${stopId} AND org_id = ${ORG}`) as unknown as Row[];
    if (!s) throw new Error("That stop is not on this site.");
    if (threadId && threadId !== s.thread_id) throw new Error("The stop belongs to another tour.");
    threadId = s.thread_id as string;
  }
  if (threadId) {
    const [t] = (await db`SELECT id FROM threads WHERE id = ${threadId} AND org_id = ${ORG} AND kind IN ('tour','experience')`) as unknown as Row[];
    if (!t) throw new Error("That tour is not on this site.");
  }
  if (placeId) {
    if (!UUID.test(placeId)) throw new Error("Unknown place.");
    const [p] = (await db`SELECT id FROM places WHERE id = ${placeId} AND org_id = ${ORG}`) as unknown as Row[];
    if (!p) throw new Error("That place is not in this catalogue.");
  }
  if (!threadId && !placeId) throw new Error("An asset belongs to a tour, a stop or a place.");
  return { threadId, stopId, placeId };
}

/**
 * Create or update an asset (editor). New assets start hidden unless
 * `visible` is passed. Visibility of hero films goes through setAssetVisible,
 * which keeps metadata.film in step.
 */
export async function upsertAsset(input: AssetInput, userId: string | null): Promise<TourAsset> {
  if (!KINDS.includes(input.kind)) throw new Error("Unknown asset kind.");
  const url = input.url?.trim() || null;
  if (!url && !LIVE.includes(input.kind)) throw new Error("This asset needs a file.");
  if (url && !acceptableUrl(url)) throw new Error("Upload the file here first, or use an https link.");
  const storage = url && url.startsWith("/api/media/") ? "nextcloud" : "external";
  const storageKey = urlKey(url);
  const fields = {
    role: input.role?.trim() || null,
    variant: input.variant?.trim() || null,
    mime: input.mimeType?.trim() || null,
    width: input.width ?? null,
    height: input.height ?? null,
    seconds: input.seconds ?? null,
    attribution: input.attribution?.trim() || null,
    licence: input.licenceNote?.trim() || null,
    caption: input.caption?.trim() || null,
    alt: input.altText?.trim() || null,
    position: Math.max(0, Math.floor(input.position ?? 0)),
  };

  if (input.id) {
    const existing = await getAsset(input.id);
    if (!existing) throw new Error("Asset not found.");
    const [r] = (await db`
      UPDATE tour_assets SET
        role = ${fields.role}, variant = ${fields.variant},
        url = ${url}, storage = ${storage}, storage_key = ${storageKey},
        mime_type = ${fields.mime}, width = ${fields.width}, height = ${fields.height}, seconds = ${fields.seconds},
        attribution = ${fields.attribution}, licence_note = ${fields.licence},
        caption = ${fields.caption}, alt_text = ${fields.alt}, position = ${fields.position}, updated_at = NOW()
      WHERE id = ${input.id} AND org_id = ${ORG}
      RETURNING *
    `) as unknown as Row[];
    let asset = mapAsset(r!);
    if (input.visible !== undefined && input.visible !== asset.visible) asset = await setAssetVisible(asset.id, input.visible);
    return asset;
  }

  const owners = await assertOwners(input);
  const [r] = (await db`
    INSERT INTO tour_assets (
      org_id, thread_id, stop_id, place_id, kind, role, variant, storage, storage_key, url, mime_type,
      width, height, seconds, source, attribution, licence_note, visible, position, caption, alt_text, created_by
    ) VALUES (
      ${ORG}, ${owners.threadId}, ${owners.stopId}, ${owners.placeId}, ${input.kind}, ${fields.role}, ${fields.variant},
      ${storage}, ${storageKey}, ${url}, ${fields.mime}, ${fields.width}, ${fields.height}, ${fields.seconds},
      ${input.source?.trim() || "upload"}, ${fields.attribution}, ${fields.licence}, false, ${fields.position},
      ${fields.caption}, ${fields.alt}, ${userId}
    ) RETURNING *
  `) as unknown as Row[];
  let asset = mapAsset(r!);
  if (input.visible) asset = await setAssetVisible(asset.id, true);
  return asset;
}

export async function archiveAsset(id: string): Promise<void> {
  const asset = await getAsset(id);
  if (!asset) throw new Error("Asset not found.");
  if (asset.visible) await setAssetVisible(id, false);
  await db`UPDATE tour_assets SET archived_at = NOW(), updated_at = NOW() WHERE id = ${id} AND org_id = ${ORG}`;
}

/** A hero film row: the one whose visibility drives metadata.film. */
function isHeroFilm(a: TourAsset): boolean {
  return a.kind === "film" && !a.stopId && a.role === "hero" && a.variant === "1080";
}

/**
 * The per-asset switch.
 *   - Showing a Private/ file copies it to public Media/ first (url and
 *     storage_key move to the public copy; the private original stays).
 *   - Showing a hero film hides the previous visible hero (and its siblings),
 *     shows this one's 720 and poster siblings, and rewrites metadata.film.
 *   - Hiding the visible hero film clears metadata.film.
 */
export async function setAssetVisible(id: string, visible: boolean): Promise<TourAsset> {
  let asset = await getAsset(id);
  if (!asset) throw new Error("Asset not found.");
  if (asset.archivedAt) throw new Error("This asset is archived.");

  if (visible) {
    asset = await publishPrivateFile(asset);
    // Siblings of a delivered render (720, poster) go public with the hero.
    if (isHeroFilm(asset) && asset.renderRequestId) {
      const sibs = (await db`
        SELECT * FROM tour_assets WHERE render_request_id = ${asset.renderRequestId} AND id <> ${asset.id} AND archived_at IS NULL
      `) as unknown as Row[];
      for (const s of sibs) await publishPrivateFile(mapAsset(s));
    }
  }

  const heroFilm = isHeroFilm(asset);
  await db.begin(async (tx) => {
    if (heroFilm && visible && asset!.threadId) {
      // Retire the current hero set (film, 720, poster) of this tour.
      await tx`
        UPDATE tour_assets SET visible = false, updated_at = NOW()
        WHERE thread_id = ${asset!.threadId} AND org_id = ${ORG} AND stop_id IS NULL AND role = 'hero'
          AND kind IN ('film','poster') AND visible AND id <> ${asset!.id}
      `;
      if (asset!.renderRequestId) {
        await tx`
          UPDATE tour_assets SET visible = true, role = 'hero', updated_at = NOW()
          WHERE render_request_id = ${asset!.renderRequestId} AND id <> ${asset!.id} AND archived_at IS NULL
            AND kind IN ('film','poster') AND stop_id IS NULL
        `;
      }
    }
    if (heroFilm && !visible && asset!.threadId && asset!.renderRequestId) {
      await tx`
        UPDATE tour_assets SET visible = false, updated_at = NOW()
        WHERE render_request_id = ${asset!.renderRequestId} AND kind IN ('film','poster') AND stop_id IS NULL
      `;
    }
    await tx`UPDATE tour_assets SET visible = ${visible}, updated_at = NOW() WHERE id = ${asset!.id} AND org_id = ${ORG}`;
    if (heroFilm && asset!.threadId) await writeFilmCache(tx as unknown as Tx, asset!.threadId);
  });
  return (await getAsset(id))!;
}

/**
 * Rewrite `threads.metadata.film` from the visible hero assets (or remove it
 * when there is none). Call inside the transaction that changed them.
 */
export async function writeFilmCache(tx: Tx, threadId: string): Promise<void> {
  const rows = (await tx`
    SELECT * FROM tour_assets
    WHERE thread_id = ${threadId} AND org_id = ${ORG} AND stop_id IS NULL AND visible AND archived_at IS NULL
      AND role = 'hero' AND kind IN ('film','poster')
    ORDER BY updated_at DESC
  `) as unknown as Row[];
  const vis = rows.map(mapAsset);
  const hero = vis.find(isHeroFilm);
  if (!hero?.url) {
    await tx`UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb) - 'film', updated_at = NOW() WHERE id = ${threadId} AND org_id = ${ORG}`;
    return;
  }
  const same = (a: TourAsset) => (hero.renderRequestId ? a.renderRequestId === hero.renderRequestId : true);
  const film = {
    url: hero.url,
    url720: vis.find((a) => a.kind === "film" && a.variant === "720" && same(a))?.url ?? null,
    poster: vis.find((a) => a.kind === "poster" && same(a))?.url ?? null,
    seconds: hero.seconds ?? 30,
    source: hero.source === "import" ? "elktour-unity" : hero.source,
    assetId: hero.id,
  };
  await tx`
    UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb) || ${tx.json({ film })}, updated_at = NOW()
    WHERE id = ${threadId} AND org_id = ${ORG}
  `;
}

/**
 * The tour page's film bar (patchTourAction) set or cleared the film: make
 * the matching assets the visible hero set and rewrite the cache. URLs are
 * already validated as our own media.
 */
export async function syncHeroFilmFromUrls(
  threadId: string,
  film: { url: string; url720: string | null; poster: string | null } | null,
  userId: string | null
): Promise<void> {
  await db.begin(async (tx) => {
    await tx`
      UPDATE tour_assets SET visible = false, updated_at = NOW()
      WHERE thread_id = ${threadId} AND org_id = ${ORG} AND stop_id IS NULL AND role = 'hero' AND kind IN ('film','poster') AND visible
    `;
    if (film) {
      const want: { kind: AssetKind; variant: string; url: string | null; mime: string }[] = [
        { kind: "film", variant: "1080", url: film.url, mime: "video/mp4" },
        { kind: "film", variant: "720", url: film.url720, mime: "video/mp4" },
        { kind: "poster", variant: "poster", url: film.poster, mime: "image/jpeg" },
      ];
      for (const w of want) {
        if (!w.url) continue;
        const [found] = (await tx`
          SELECT id FROM tour_assets WHERE thread_id = ${threadId} AND org_id = ${ORG} AND url = ${w.url} AND kind = ${w.kind}
            AND stop_id IS NULL AND archived_at IS NULL LIMIT 1
        `) as unknown as Row[];
        if (found) {
          await tx`UPDATE tour_assets SET visible = true, role = 'hero', variant = ${w.variant}, updated_at = NOW() WHERE id = ${found.id as string}`;
        } else {
          await tx`
            INSERT INTO tour_assets (org_id, thread_id, kind, role, variant, storage, storage_key, url, mime_type, seconds,
                                     source, attribution, licence_note, visible, created_by)
            VALUES (${ORG}, ${threadId}, ${w.kind}, 'hero', ${w.variant}, 'nextcloud', ${urlKey(w.url)}, ${w.url}, ${w.mime},
                    ${w.kind === "film" ? 30 : null}, 'upload', 'Google, Cesium',
                    'Google Maps Platform 3D Tiles: promotional use only, <=30 s, uncropped, credit kept', true, ${userId})
          `;
        }
      }
    }
    await writeFilmCache(tx as unknown as Tx, threadId);
  });
}

/** Copy a catalogue (place) asset into a stop row, hidden; visibility stays per tour. */
export async function copyPlaceAssetToStop(placeAssetId: string, stopId: string, userId: string | null): Promise<TourAsset> {
  const src = await getAsset(placeAssetId);
  if (!src || !src.placeId || src.threadId) throw new Error("That is not a catalogue asset.");
  const owners = await assertOwners({ stopId });
  const [dup] = (await db`
    SELECT * FROM tour_assets WHERE stop_id = ${stopId} AND archived_at IS NULL AND meta->>'fromPlaceAssetId' = ${src.id} LIMIT 1
  `) as unknown as Row[];
  if (dup) return mapAsset(dup);
  const [r] = (await db`
    INSERT INTO tour_assets (
      org_id, thread_id, stop_id, place_id, kind, role, variant, storage, storage_key, url, mime_type, bytes, width, height,
      seconds, sha256, source, attribution, licence_note, visible, position, caption, alt_text, meta, created_by
    ) VALUES (
      ${ORG}, ${owners.threadId}, ${stopId}, ${src.placeId}, ${src.kind}, ${src.role}, ${src.variant}, ${src.storage},
      ${src.storageKey}, ${src.url}, ${src.mimeType}, ${src.bytes}, ${src.width}, ${src.height}, ${src.seconds}, ${src.sha256},
      'place', ${src.attribution}, ${src.licenceNote}, false, ${src.position}, ${src.caption}, ${src.altText},
      ${db.json({ fromPlaceAssetId: src.id })}, ${userId}
    ) RETURNING *
  `) as unknown as Row[];
  return mapAsset(r!);
}

// ── photos: EXIF stripping ────────────────────────────────────────────────

/** True for HEIC/HEIF (phone) files, which this server cannot decode (sharp's libvips has no HEVC). */
export function isHeic(buf: Uint8Array): boolean {
  if (buf.length < 12) return false;
  const box = Buffer.from(buf.subarray(4, 12)).toString("latin1");
  return box.startsWith("ftyp") && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|heif)$/.test(box.slice(4, 8));
}

/**
 * Re-encode a photo with no metadata: orientation applied to the pixels, then EXIF/XMP/IPTC
 * (GPS included) dropped (sharp writes none unless asked). JPEG stays JPEG, PNG/WebP keep
 * their format. HEIC is refused with a message the editor can act on.
 */
export async function stripImageMetadata(input: Buffer): Promise<{ stripped: Buffer; ext: string; mime: string }> {
  if (isHeic(input)) {
    throw new Error("This photo is in HEIC format, which the site cannot show yet. Export it as JPEG (or set the phone camera to 'Most Compatible') and upload that.");
  }
  const sharp = (await import("sharp")).default;
  const img = sharp(input, { failOn: "error" }).rotate();
  const meta = await sharp(input).metadata();
  let out: { stripped: Buffer; ext: string; mime: string };
  if (meta.format === "png") out = { stripped: await img.png().toBuffer(), ext: "png", mime: "image/png" };
  else if (meta.format === "webp") out = { stripped: await img.webp({ quality: 88 }).toBuffer(), ext: "webp", mime: "image/webp" };
  else out = { stripped: await img.jpeg({ quality: 88, mozjpeg: true }).toBuffer(), ext: "jpg", mime: "image/jpeg" };
  // Belt and braces: refuse to publish if any GPS survived.
  const exifr = (await import("exifr")).default;
  const gps = await exifr.gps(out.stripped).catch(() => null);
  if (gps && Number.isFinite(gps.latitude)) throw new Error("Could not remove the location from this photo; it was not published.");
  return out;
}

// ── Nextcloud: private → public copy ─────────────────────────────────────

function davUrl(key: string): string {
  const base = (process.env.NEXTCLOUD_URL ?? "").replace(/\/$/, "");
  const user = process.env.NEXTCLOUD_ADMIN_USER ?? "";
  return `${base}/remote.php/dav/files/${encodeURIComponent(user)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
function davAuth(): string {
  return `Basic ${Buffer.from(`${process.env.NEXTCLOUD_ADMIN_USER ?? ""}:${process.env.NEXTCLOUD_ADMIN_PASSWORD ?? ""}`).toString("base64")}`;
}

/** If the asset's file is under Private/, copy it to the public twin path and point the row at it. */
async function publishPrivateFile(asset: TourAsset): Promise<TourAsset> {
  const key = asset.storageKey ?? urlKey(asset.url);
  if (!isPrivateKey(key)) return asset;
  let publicKey = key!.replace(`EAC_Network/${ORG}/Private/`, `EAC_Network/${ORG}/`);
  if (!process.env.NEXTCLOUD_URL) throw new Error("File storage is not configured.");

  // Photos: the public copy is re-encoded without EXIF (GPS, camera, time), so a phone
  // picture never publishes where it was taken. Films and documents are copied as they are.
  if (["image", "still", "poster"].includes(asset.kind)) {
    const got = await fetch(davUrl(key!), { headers: { Authorization: davAuth() }, signal: AbortSignal.timeout(120_000) });
    if (!got.ok) throw new Error(`Could not read the file (storage answered ${got.status}).`);
    const { stripped, ext, mime } = await stripImageMetadata(Buffer.from(await got.arrayBuffer()));
    publicKey = publicKey.replace(/\.[a-z0-9]+$/i, `.${ext}`);
    const put = await fetch(davUrl(publicKey), {
      method: "PUT",
      headers: { Authorization: davAuth(), "Content-Type": mime },
      body: new Uint8Array(stripped),
      signal: AbortSignal.timeout(120_000),
    });
    if (!put.ok) throw new Error(`Could not publish the file (storage answered ${put.status}).`);
    const [r] = (await db`
      UPDATE tour_assets SET storage_key = ${publicKey}, url = ${`/api/media/${publicKey}`}, mime_type = ${mime},
        bytes = ${stripped.length}, meta = meta || ${db.json({ privateKey: key, exifStripped: true })}, updated_at = NOW()
      WHERE id = ${asset.id} RETURNING *
    `) as unknown as Row[];
    return mapAsset(r!);
  }

  const res = await fetch(davUrl(key!), {
    method: "COPY",
    headers: { Authorization: davAuth(), Destination: davUrl(publicKey), Overwrite: "T" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`Could not publish the file (storage answered ${res.status}).`);
  }
  const url = `/api/media/${publicKey}`;
  const [r] = (await db`
    UPDATE tour_assets SET storage_key = ${publicKey}, url = ${url},
      meta = meta || ${db.json({ privateKey: key })}, updated_at = NOW()
    WHERE id = ${asset.id} RETURNING *
  `) as unknown as Row[];
  return mapAsset(r!);
}

/** Batch listAssets({placeId}) for many places (catalogue assets only, not archived). Every id gets an entry. */
export async function listPlaceAssetsMany(placeIds: string[]): Promise<Map<string, TourAsset[]>> {
  const out = new Map<string, TourAsset[]>();
  const valid = placeIds.filter((id) => UUID.test(id));
  for (const id of valid) out.set(id, []);
  if (valid.length === 0) return out;
  try {
    const rows = (await db`
      SELECT * FROM tour_assets
      WHERE org_id = ${ORG} AND place_id = ANY(${valid}::uuid[]) AND thread_id IS NULL AND archived_at IS NULL
      ORDER BY kind, position, created_at DESC
    `) as unknown as Row[];
    for (const r of rows) out.get(r.place_id as string)?.push(mapAsset(r));
  } catch (err) {
    console.error("[elktours] listPlaceAssetsMany:", err);
  }
  return out;
}
