/**
 * Photo upload.
 *
 * Open to anonymous contributors — that is the whole point of the project — so
 * this route is the one that has to be careful. In order:
 *
 *   identity → rate limit → size → magic bytes → EXIF read → RE-ENCODE → store
 *
 * The re-encode is the load-bearing step, and it does three jobs at once:
 *
 *  1. Strips metadata. Phone photos carry GPS to about five metres, plus the
 *     device serial and often the owner's name. Everything under
 *     /api/media that isn't in a Private folder is served publicly with a
 *     one-year immutable cache, so shipping originals would be a leak with no
 *     revocation. sharp writes no metadata unless .withMetadata() is called,
 *     and we never call it.
 *  2. Neutralises polyglots. validateUploadBuffer checks leading bytes; it
 *     cannot catch a payload appended after valid JPEG data. Decoding to
 *     pixels and re-encoding discards everything that isn't image data.
 *  3. Caps the size actually served. A 25MB original becomes a ~2000px JPEG
 *     plus an 800px card derivative.
 *
 * GPS is read BEFORE the strip and returned to the client, so the submit form
 * can drop the map pin where the photo was taken. It is never persisted from
 * here — the pin the contributor confirms is what gets stored.
 */

import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { validateUploadBuffer } from "@elkdonis/utils";
import { nanoid } from "nanoid";
import sharp from "sharp";
import exifr from "exifr";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { getClientIp, getGuest, requireWritableGuest } from "@/lib/guest";
import { checkRate, recordRate } from "@/lib/rate-limit";
import {
  ensureFolderTree,
  isNextcloudConfigured,
  proxyUrl,
  putFile,
  uploadPath,
} from "@/lib/nextcloud";

// sharp is a native module and the re-encode is CPU-bound — neither survives
// the edge runtime, and a 25MB photo needs more than the default budget.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = siteConfig.maxUploadMb * 1024 * 1024;

/**
 * Guard against decompression bombs: a small file that claims enormous
 * dimensions. 100 megapixels is far beyond any real camera and far below
 * anything that would exhaust the container.
 */
const MAX_PIXELS = 100_000_000;

export async function POST(request: NextRequest) {
  try {
    if (!isNextcloudConfigured()) {
      console.error("[pigeonshoot] upload: NEXTCLOUD_* env is incomplete");
      return NextResponse.json(
        { error: "Photo storage isn't configured. Nothing you did wrong — try again later." },
        { status: 503 }
      );
    }

    // 1. Identity — READ ONLY at this stage.
    //
    //    Deliberately does not mint a guest yet. Minting up front means every
    //    rejected request from a cookieless client leaves a `pigeon_guests`
    //    row behind, so anyone could fill that table by POSTing garbage in a
    //    loop. The guest is created at step 7, once the photo has actually
    //    passed validation. Until then the IP limit is what protects us, which
    //    is exactly the case it exists for.
    const viewer = await getViewer().catch(() => null);
    const ip = await getClientIp();
    const existingGuest = viewer ? null : await getGuest();

    if (existingGuest?.isBlocked) {
      return NextResponse.json(
        { error: "This browser has been blocked from contributing." },
        { status: 403 }
      );
    }

    // 2. Rate limit. Editors bypass — the owner curating their own project
    //    should never be told to slow down.
    if (!viewer?.canEdit) {
      const rate = await checkRate("upload", {
        guestId: existingGuest?.id,
        userId: viewer?.userId,
        ip,
      });
      if (!rate.ok) {
        return NextResponse.json(
          { error: rate.reason },
          { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    // 3. Size, checked before arrayBuffer() so an oversized upload never gets
    //    fully materialised in memory.
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Photos need to be under ${siteConfig.maxUploadMb}MB.` },
        { status: 413 }
      );
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "That's not an image." }, { status: 415 });
    }

    const input = Buffer.from(await file.arrayBuffer());

    // 4. Magic bytes. The declared Content-Type is trivially spoofed.
    //    validateUploadBuffer classifies SVG as its own kind, never 'image',
    //    so scriptable SVGs are rejected here for free.
    const validation = validateUploadBuffer(input, ["image"]);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.reason }, { status: 415 });
    }

    // 5. Read EXIF while it still exists. Both calls are best-effort: a photo
    //    with no metadata is completely normal, not an error.
    const gps = await exifr.gps(input).catch(() => null);
    const taken = await exifr
      .parse(input, ["DateTimeOriginal", "CreateDate"])
      .catch(() => null);

    const capturedAt: string | null =
      taken?.DateTimeOriginal instanceof Date
        ? taken.DateTimeOriginal.toISOString()
        : taken?.CreateDate instanceof Date
          ? taken.CreateDate.toISOString()
          : null;

    // 6. Re-encode. See the header for why this is not optional.
    let full: { data: Buffer; info: sharp.OutputInfo };
    let card: { data: Buffer; info: sharp.OutputInfo };
    try {
      // .rotate() with NO argument means "apply the EXIF orientation flag, then
      // discard it". Omit it and every portrait phone photo lands sideways,
      // because we're about to throw the orientation tag away.
      full = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" })
        .rotate()
        .resize({
          width: siteConfig.fullImageEdge,
          height: siteConfig.fullImageEdge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

      card = await sharp(full.data)
        .resize({
          width: siteConfig.cardImageEdge,
          height: siteConfig.cardImageEdge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
    } catch (err) {
      // The prebuilt sharp binary's libvips has AVIF but no HEIC decoder
      // (verified: format.heif.input.fileSuffix is ['.avif']), so iPhone-native
      // HEIC throws here. Say so specifically rather than returning a generic
      // failure the contributor can't act on.
      const heic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
      console.error("[pigeonshoot] upload re-encode:", err);
      return NextResponse.json(
        {
          error: heic
            ? "iPhone HEIC photos aren't supported yet. Upload straight from your phone, or switch Settings → Camera → Formats to “Most Compatible”."
            : "That image couldn't be read. Try a JPEG or PNG.",
        },
        { status: 415 }
      );
    }

    // 7. The photo is real. NOW mint the guest identity, so a rejected upload
    //    never leaves a row behind (see step 1).
    let guestId: string | null = existingGuest?.id ?? null;
    if (!viewer && !guestId) {
      const guest = await requireWritableGuest();
      if (!guest.ok) return NextResponse.json({ error: guest.reason }, { status: 403 });
      guestId = guest.guest.id;
    }

    // 8. Store. Both variants are public — safe now that they carry no
    //    metadata — so /api/media serves them without a session.
    const stem = `${Date.now()}-${nanoid(8)}`;
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/\.[^.]*$/, "");
    const filename = `${stem}-${safeName || "pigeon"}.jpg`;

    const fullPath = uploadPath(filename, "full");
    const cardPath = uploadPath(filename, "card");

    try {
      await ensureFolderTree("EAC_Network/pigeonshoot/Media/Images/card");
      await putFile(fullPath, full.data, "image/jpeg");
      await putFile(cardPath, card.data, "image/jpeg");
    } catch (err) {
      console.error("[pigeonshoot] upload storage:", err);
      return NextResponse.json(
        { error: "Couldn't save the photo. Try again in a moment." },
        { status: 502 }
      );
    }

    // 9. Record it. attached_to_* stays NULL until the card is created — the
    //    media_check constraint allows both-NULL, which is what an unattached
    //    library upload looks like.
    const mediaId = nanoid();
    try {
      await db`
        INSERT INTO media (
          id, org_id, uploaded_by, nextcloud_file_id, nextcloud_path,
          url, type, filename, size_bytes, mime_type, width, height
        ) VALUES (
          ${mediaId}, ${siteConfig.orgId},
          ${viewer?.userId ?? siteConfig.sentinelUserId},
          ${filename}, ${fullPath},
          ${proxyUrl(fullPath)}, 'image', ${file.name}, ${full.data.length},
          'image/jpeg', ${full.info.width}, ${full.info.height}
        )
      `;
    } catch (err) {
      console.error("[pigeonshoot] upload db:", err);
      return NextResponse.json(
        { error: "Photo saved but we lost track of it. Try again." },
        { status: 500 }
      );
    }

    if (!viewer?.canEdit) {
      await recordRate("upload", { guestId, userId: viewer?.userId, ip });
    }

    return NextResponse.json({
      id: mediaId,
      url: proxyUrl(fullPath),
      path: fullPath,
      width: full.info.width,
      height: full.info.height,
      card: {
        url: proxyUrl(cardPath),
        path: cardPath,
        width: card.info.width,
        height: card.info.height,
      },
      // Where the phone says the photo was taken. The client uses this to
      // place the pin; it is never trusted as the stored location.
      exif:
        gps && typeof gps.latitude === "number" && typeof gps.longitude === "number"
          ? { lat: gps.latitude, lng: gps.longitude, capturedAt }
          : capturedAt
            ? { lat: null, lng: null, capturedAt }
            : null,
    });
  } catch (err) {
    console.error("[pigeonshoot] upload:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
