import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { validateUploadBuffer } from "@elkdonis/utils";
import { canEditSeries } from "@elkdonis/commerce/server";
import {
  createUserFolder,
  getProxyFileUrl,
  getStorageSlug,
  resolveUserPath,
  uploadFile,
  uploadFilename,
} from "@elkdonis/services";

const MAX_IMAGE_MB = 25;
const MAX_VIDEO_MB = 250;

/**
 * Series page media (hero image or video, card image) from the series
 * workspace. Editors of the series only. Files go to the uploader's
 * EAC_Network/users/<slug>/Media/{Images,Videos}/ tree: no `Private/`
 * segment, so `/api/media` serves them to anonymous visitors, as a public
 * landing page needs.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = session.user.db_user_id ?? session.user.id;

    const form = await request.formData();
    const seriesId = String(form.get("seriesId") ?? "");
    const file = form.get("file") as File | null;
    if (!seriesId || !file) return NextResponse.json({ error: "Missing file or series." }, { status: 400 });
    if (!(await canEditSeries(userId, seriesId))) {
      return NextResponse.json({ error: "You cannot edit this series." }, { status: 403 });
    }

    const isVideo = file.type.startsWith("video/");
    if (!isVideo && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Upload an image or a video." }, { status: 400 });
    }
    const maxMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (file.size > maxMb * 1024 * 1024) {
      return NextResponse.json({ error: `The file must be smaller than ${maxMb} MB.` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateUploadBuffer(buffer, [isVideo ? "video" : "image"]);
    if (!validation.ok) {
      return NextResponse.json({ error: "reason" in validation ? validation.reason : "Rejected" }, { status: 415 });
    }

    const slug = await getStorageSlug(userId);
    if (!slug) return NextResponse.json({ error: "Your account has no storage folder yet." }, { status: 500 });
    const folder = isVideo ? "Media/Videos" : "Media/Images";
    if (!(await createUserFolder(slug, folder))) {
      return NextResponse.json({ error: "Could not prepare your storage folder." }, { status: 500 });
    }
    const relativePath = resolveUserPath(slug, `${folder}/${uploadFilename(file.name, null)}`);
    if (!(await uploadFile(relativePath, buffer, file.type))) {
      return NextResponse.json({ error: "Failed to upload file to storage." }, { status: 502 });
    }
    return NextResponse.json({
      url: getProxyFileUrl(relativePath),
      path: relativePath,
      kind: isVideo ? "video" : "image",
      mimeType: file.type,
    });
  } catch (error) {
    console.error("[art-auction series media] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
