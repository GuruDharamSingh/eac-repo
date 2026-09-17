import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { uploadFile, getUploadPath, getProxyFileUrl } from "@elkdonis/services";
import { validateUploadBuffer } from "@elkdonis/utils";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

const ORG_ID = siteConfig.orgId;

/**
 * Uploads into the ORG's media tree (`EAC_Network/ifac/Media/...`).
 *
 * This is the second upload route, and the distinction is the whole point.
 * `/api/upload` puts a file in an ARTIST's own folder
 * (`EAC_Network/users/<slug>/`) because a portrait and a body of work belong
 * to the artist and follow them across every org that publishes them. It
 * therefore requires a `memberSlug`, and rightly refuses without one.
 *
 * A meeting's cover image is not an artist's work — it is IFAC's. The compose
 * surface's media picker was posting to that route with no slug and getting
 * "memberSlug is required" back, which read as a permissions failure to
 * whoever was composing ("I'm the owner, why won't it let me?") when in fact
 * the org had no org-media upload path at all.
 *
 * Owner/guide only: uploading here is publishing for the collective. Modelled
 * on amrit-canada's equivalent, including the visibility-based path routing,
 * so a members-only item's cover lands under `Private/Media`.
 */

type MediaCategory = "image" | "audio" | "video" | "document";

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
]);

const MEDIA_CONFIG: Array<{
  type: MediaCategory;
  folder: "Images" | "Audio" | "Videos" | "Documents";
  maxSizeMb: number;
  test: (mime: string) => boolean;
}> = [
  { type: "image", folder: "Images", maxSizeMb: 25, test: (m) => m.startsWith("image/") },
  { type: "audio", folder: "Audio", maxSizeMb: 150, test: (m) => m.startsWith("audio/") },
  { type: "video", folder: "Videos", maxSizeMb: 500, test: (m) => m.startsWith("video/") },
  { type: "document", folder: "Documents", maxSizeMb: 50, test: (m) => DOCUMENT_MIME_TYPES.has(m) },
];

export async function POST(request: NextRequest) {
  try {
    const editor = await getApiEditor();
    if (!editor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const rawVisibility = String(formData.get("visibility") ?? "PUBLIC");
    const visibility =
      rawVisibility === "ORGANIZATION" || rawVisibility === "INVITE_ONLY"
        ? rawVisibility
        : "PUBLIC";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const config = MEDIA_CONFIG.find((c) => c.test(file.type));
    if (!config) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || "unknown"}` },
        { status: 400 }
      );
    }
    if (file.size > config.maxSizeMb * 1024 * 1024) {
      return NextResponse.json(
        { error: `${config.type} files must be under ${config.maxSizeMb}MB` },
        { status: 400 }
      );
    }

    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const relativePath = getUploadPath(ORG_ID, config.folder, filename, visibility);
    const buffer = Buffer.from(await file.arrayBuffer());

    // The `test:` predicates above match the CLIENT-supplied MIME string,
    // which is attacker-controlled, and `image/svg+xml` passes
    // `startsWith("image/")`. An SVG is a script container, so the actual
    // leading bytes decide — validateUploadBuffer classifies SVG as its own
    // kind and never as `image`.
    const validation = validateUploadBuffer(buffer, [config.type], {
      allowText: file.type === "text/plain",
    });
    if (!validation.ok) {
      return NextResponse.json(
        { error: "reason" in validation ? validation.reason : "Rejected" },
        { status: 415 }
      );
    }

    if (!(await uploadFile(relativePath, buffer, file.type))) {
      return NextResponse.json({ error: "Failed to upload to Nextcloud" }, { status: 500 });
    }

    const url = getProxyFileUrl(relativePath);

    // Recorded in `media` so the library picker can offer it again — without
    // this the file exists in Nextcloud but the "Library" tab never sees it.
    // A failed row must not fail the upload: the file is already stored, and
    // throwing here would tell the person their upload failed when it did not.
    const mediaId = nanoid();
    try {
      await db`
        INSERT INTO media (
          id, org_id, uploaded_by, nextcloud_file_id, nextcloud_path,
          url, type, filename, size_bytes, mime_type
        ) VALUES (
          ${mediaId}, ${ORG_ID}, ${editor.userId}, ${filename}, ${relativePath},
          ${url}, ${config.type}, ${file.name}, ${file.size}, ${file.type}
        )
      `;
    } catch (error) {
      console.error("[ifac] org media upload — row not recorded:", error);
    }

    return NextResponse.json({ success: true, id: mediaId, url, path: relativePath, type: config.type });
  } catch (error) {
    console.error("[ifac] org media upload:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
