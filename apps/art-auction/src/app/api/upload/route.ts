import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { validateUploadBuffer } from "@elkdonis/utils";
import { db } from "@elkdonis/db";
import {
  createUserFolder,
  getProxyFileUrl,
  getStorageSlug,
  resolveUserPath,
  uploadFile,
  uploadFilename,
} from "@elkdonis/services";

const MAX_IMAGE_MB = 25;

/**
 * Multi-image artwork upload. Auth-gated: only signed-in marketplace artists
 * (people who already have a store) may upload.
 *
 * Fixed 2026-09-21: this used to hand-roll its own WebDAV PUT into
 * `marketplace/<owner_user_id>/Images/…`, a tree `/api/media` never
 * recognises — `canReadMedia` only serves `EAC_Network/…` (media-authz.ts).
 * Every image ever uploaded through this form 404'd invisibly: the studio
 * form showed an attached file with no preview, and the public listing
 * showed a grey placeholder, even though the PUT to Nextcloud had actually
 * succeeded. This now writes into the same EAC_Network/users/<slug>/Media/
 * Images/ tree — via the shared dav helpers — every other app's uploads use.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.db_user_id ?? session.user.id;

    // Only people who already have a store may upload here.
    let hasStore = false;
    try {
      const rows = (await db`
        SELECT 1 AS present FROM store WHERE owner_user_id = ${userId} LIMIT 1
      `) as unknown as Array<{ present: number }>;
      hasStore = rows.length > 0;
    } catch {
      // fall through to the 403 below
    }
    if (!hasStore) {
      return NextResponse.json(
        { error: "Only marketplace artists can upload artwork media." },
        { status: 403 }
      );
    }

    const slug = await getStorageSlug(userId);
    if (!slug) {
      return NextResponse.json(
        { error: "Your account has no storage folder yet." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || "unknown"}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Image must be smaller than ${MAX_IMAGE_MB}MB` },
        { status: 400 }
      );
    }

    // Named after the work when the surface sends a title, else after the
    // uploaded file. This address outlives the upload — it is what a stored
    // page, a gallery item and every <img src> carries. See uploadFilename.
    const title = String(formData.get("title") ?? "").trim().slice(0, 200);
    const filename = uploadFilename(file.name, title || null);

    const buffer = Buffer.from(await file.arrayBuffer());

    // Verify actual bytes are a raster image (client MIME is spoofable).
    const validation = validateUploadBuffer(buffer, ["image"]);
    if (!validation.ok) {
      // `in` rather than `validation.reason`: UploadValidation is a true
      // discriminated union, which this codebase repeatedly finds does not
      // narrow on `if (!x.ok)` — same idiom as arts-collective's upload route.
      return NextResponse.json(
        { error: "reason" in validation ? validation.reason : "Rejected" },
        { status: 415 }
      );
    }

    // A fresh artist may not have Media/Images yet — WebDAV PUT into a
    // missing folder 409s, so make it first. Idempotent.
    if (!(await createUserFolder(slug, "Media/Images"))) {
      return NextResponse.json(
        { error: "Could not prepare your storage folder." },
        { status: 500 }
      );
    }

    const relativePath = resolveUserPath(slug, `Media/Images/${filename}`);
    const uploaded = await uploadFile(relativePath, buffer, file.type);
    if (!uploaded) {
      return NextResponse.json(
        { error: "Failed to upload file to storage." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      url: getProxyFileUrl(relativePath),
      path: relativePath,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    });
  } catch (error) {
    console.error("[art-auction upload] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
