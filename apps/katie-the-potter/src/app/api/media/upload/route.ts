import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { createUserFolder, uploadFile, getProxyFileUrl, getStorageSlug, resolveUserPath, uploadFilename } from "@elkdonis/services";
import { validateUploadBuffer } from "@elkdonis/utils";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { getSiteArtistUserId, getViewer } from "@/lib/auth";
import { ensurePictureFolder } from "@/lib/site-store";
import { siteConfig } from "@/config/site";

const ORG_ID = siteConfig.orgId;
const MAX_SIZE_MB = 25;
const HEIC = /^image\/hei[cf]/i;
// Most browsers cannot show HEIC (iPhone's own format), so it is refused
// rather than stored as a picture nobody but Safari can see.
// Short: the uploader shows only two lines on a picture tile, about 40
// characters on a phone (docs/ONBOARDING.md has the longer how-to).
const HEIC_MESSAGE = "HEIC photo: please send a JPEG.";

/**
 * Single-purpose upload route for this site: images only, for the gallery
 * pages (user_galleries, via @elkdonis/cms-ui/gallery's uploadEndpoint) —
 * this is a one-artist portfolio site, not the multi-media-type pipeline
 * amrit-canada's meeting attachments need. Gated the same way as every
 * write here: getViewer().canEdit (owner/guide on org `katie-the-potter`).
 *
 * WHERE files go. This is Katie's own site, so everything uploaded here
 * is hers, whoever at the keyboard did the uploading (`media.uploaded_by`
 * still records that): EAC_Network/users/<her storage slug>/…
 *
 *   no `gallery`      → Media/Images/        (what "My images" lists)
 *   `gallery=<slug>`  → Galleries/<slug>/    (that gallery's own folder)
 *
 * Fixed 2026-09-18: this used to write to users/<uploader's account id>/ —
 * a folder named by a UUID that no library ever listed, so an upload from the
 * editor vanished from the picker. Paths are now built through
 * resolveUserPath, which refuses anything that escapes her folder.
 *
 * Fixed 2026-11-06 (onboarding): "her" is the owner of the site's pinned
 * store (lib/site-store.ts), not the earliest org owner, so after the
 * hand-over her uploads land in HER folder. A brand-new account has no
 * Nextcloud folder yet: the route makes it (gainSpace) once and retries,
 * instead of failing her first upload. Error messages are written for her.
 */
export async function POST(request: NextRequest) {
  try {
    const viewer = await getViewer();
    if (!viewer?.canEdit) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (HEIC.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
      return NextResponse.json({ error: HEIC_MESSAGE }, { status: 415 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Not a photo. Use JPEG, PNG or WebP." }, { status: 400 });
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      const mb = (file.size / 1024 / 1024).toFixed(0);
      return NextResponse.json(
        { error: `Too large: ${mb} MB (limit ${MAX_SIZE_MB} MB).` },
        { status: 413 }
      );
    }

    // Named after the work when the surface sends a title, else after the
    // uploaded file. This address outlives the upload — it is what a stored
    // page, a gallery item and every <img src> carries. See uploadFilename.
    const title = String(formData.get("title") ?? "").trim().slice(0, 200);
    const filename = uploadFilename(file.name, title || null);
    const ownerId = await getSiteArtistUserId();
    if (!ownerId) return NextResponse.json({ error: "This site has no owner yet, so there is nowhere to keep pictures." }, { status: 500 });
    let slug = await getStorageSlug(ownerId);
    if (!slug && (await ensurePictureFolder(ownerId))) slug = await getStorageSlug(ownerId);
    if (!slug) {
      return NextResponse.json({ error: "Picture folder not ready: see Overview." }, { status: 500 });
    }

    const gallery = String(formData.get("gallery") ?? "").trim();
    if (gallery && !/^[a-z0-9][a-z0-9-]{0,79}$/.test(gallery)) {
      return NextResponse.json({ error: "Unknown gallery" }, { status: 400 });
    }
    // A gallery's folder may not exist yet — WebDAV PUT into a missing
    // folder fails (409), so make it first. Idempotent.
    if (gallery && !(await createUserFolder(slug, `Galleries/${gallery}`))) {
      return NextResponse.json({ error: "Could not create the gallery folder" }, { status: 500 });
    }
    const relativePath = resolveUserPath(
      slug,
      gallery ? `Galleries/${gallery}/${filename}` : `Media/Images/${filename}`
    );

    const buffer = Buffer.from(await file.arrayBuffer());

    // Client-supplied MIME is attacker-controlled and `image/svg+xml` passes
    // `startsWith("image/")` — verify the real leading bytes instead.
    const validation = validateUploadBuffer(buffer, ["image"]);
    if (validation.ok && HEIC.test(validation.sniffed.mime)) {
      return NextResponse.json({ error: HEIC_MESSAGE }, { status: 415 });
    }
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Can't read this photo. Use a JPEG." },
        { status: 415 }
      );
    }

    let uploadSuccess = await uploadFile(relativePath, buffer, file.type);
    if (!uploadSuccess) {
      // Most often the folder isn't there yet (a new account): make it, then once more.
      await ensurePictureFolder(ownerId);
      if (!gallery) await createUserFolder(slug, "Media/Images");
      uploadSuccess = await uploadFile(relativePath, buffer, file.type);
    }
    if (!uploadSuccess) {
      return NextResponse.json({ error: "Couldn't save it. Try again shortly." }, { status: 500 });
    }

    const fileUrl = getProxyFileUrl(relativePath);
    const mediaId = nanoid();

    await db`
      INSERT INTO media (id, org_id, uploaded_by, nextcloud_file_id, nextcloud_path, url, type, filename, size_bytes, mime_type)
      VALUES (${mediaId}, ${ORG_ID}, ${viewer.userId}, ${filename}, ${relativePath}, ${fileUrl}, 'image', ${file.name}, ${file.size}, ${file.type})
    `;

    return NextResponse.json({ success: true, id: mediaId, url: fileUrl, filename: file.name, size: file.size });
  } catch (error) {
    console.error("[katie-the-potter] upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
