import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { uploadFile, getUploadPath, getProxyFileUrl } from "@elkdonis/services";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import type { MeetingVisibility } from "@elkdonis/types";

/**
 * Uploads a service's cover/banner image to EAC_Network/<org>/Media/Images
 * in Nextcloud and records it in the `media` table. Ported from
 * amrit-canada's api/upload — same folder convention, same media row shape.
 */

const ORG_ID = siteConfig.orgId;

const MAX_SIZE_MB = 25;

export async function POST(request: NextRequest) {
  try {
    const editor = await getApiEditor();
    if (!editor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const visibility = (formData.get("visibility") as MeetingVisibility) || "PUBLIC";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || "unknown"}` }, { status: 400 });
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File size must be less than ${MAX_SIZE_MB}MB` }, { status: 400 });
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${timestamp}-${sanitizedName}`;
    const relativePath = getUploadPath(ORG_ID, "Images", filename, visibility);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadSuccess = await uploadFile(relativePath, buffer, file.type);
    if (!uploadSuccess) {
      return NextResponse.json({ error: "Failed to upload file to Nextcloud" }, { status: 500 });
    }

    const fileUrl = getProxyFileUrl(relativePath);
    const mediaId = nanoid();

    try {
      await db`
        INSERT INTO media (
          id, org_id, uploaded_by, nextcloud_file_id, nextcloud_path,
          url, type, filename, size_bytes, mime_type
        ) VALUES (
          ${mediaId}, ${ORG_ID}, ${editor.userId}, ${filename}, ${relativePath},
          ${fileUrl}, 'image', ${file.name}, ${file.size}, ${file.type}
        )
      `;

      return NextResponse.json({
        success: true,
        id: mediaId,
        url: fileUrl,
        path: relativePath,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });
    } catch (dbError) {
      console.error("[hidden-enneagram] upload db error:", dbError);
      return NextResponse.json({ error: "File uploaded but failed to save metadata" }, { status: 500 });
    }
  } catch (error) {
    console.error("[hidden-enneagram] upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
