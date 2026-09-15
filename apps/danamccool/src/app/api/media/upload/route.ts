import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { uploadFile, getProxyFileUrl } from "@elkdonis/services";
import { validateUploadBuffer } from "@elkdonis/utils";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { getViewer } from "@/lib/auth";
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
 * Stored under EAC_Network/users/<uploader>/, matching IFAC's convention:
 * an artist's work follows them, it isn't org-owned.
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

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${timestamp}-${sanitizedName}`;
    const relativePath = `EAC_Network/users/${viewer.userId}/Media/Images/${filename}`;

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
