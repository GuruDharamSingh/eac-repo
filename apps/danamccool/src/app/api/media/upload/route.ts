import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { createUserFolder, uploadFile, getProxyFileUrl, getStorageSlug, resolveUserPath, uploadFilename } from "@elkdonis/services";
import { validateUploadBuffer } from "@elkdonis/utils";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { getSiteOwnerUserId, getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

const ORG_ID = siteConfig.orgId;
const MAX_SIZE_MB = 25;

/**
 * Single-purpose upload route for this site: images only, for the gallery
 * pages (user_galleries, via @elkdonis/cms-ui/gallery's uploadEndpoint) —
 * this is a one-artist portfolio site, not the multi-media-type pipeline
 * amrit-canada's meeting attachments need. Gated the same way as every
 * write here: getViewer().canEdit (owner/guide on org `danamccool`).
 *
 * WHERE files go. This is Dana's personal site, so everything uploaded here
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
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || "unknown"}` }, { status: 400 });
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File size must be less than ${MAX_SIZE_MB}MB` }, { status: 400 });
    }

    // Named after the work when the surface sends a title, else after the
    // uploaded file. This address outlives the upload — it is what a stored
    // page, a gallery item and every <img src> carries. See uploadFilename.
    const title = String(formData.get("title") ?? "").trim().slice(0, 200);
    const filename = uploadFilename(file.name, title || null);
    const ownerId = await getSiteOwnerUserId();
    const slug = ownerId ? await getStorageSlug(ownerId) : null;
    if (!slug) return NextResponse.json({ error: "The site owner has no storage folder yet" }, { status: 500 });

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
    if (!validation.ok) {
      return NextResponse.json(
        { error: "reason" in validation ? validation.reason : "Rejected" },
        { status: 415 }
      );
    }

    const uploadSuccess = await uploadFile(relativePath, buffer, file.type);
    if (!uploadSuccess) {
      return NextResponse.json({ error: "Failed to upload file to Nextcloud" }, { status: 500 });
    }

    const fileUrl = getProxyFileUrl(relativePath);
    const mediaId = nanoid();

    await db`
      INSERT INTO media (id, org_id, uploaded_by, nextcloud_file_id, nextcloud_path, url, type, filename, size_bytes, mime_type)
      VALUES (${mediaId}, ${ORG_ID}, ${viewer.userId}, ${filename}, ${relativePath}, ${fileUrl}, 'image', ${file.name}, ${file.size}, ${file.type})
    `;

    return NextResponse.json({ success: true, id: mediaId, url: fileUrl, filename: file.name, size: file.size });
  } catch (error) {
    console.error("[danamccool] upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
