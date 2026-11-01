import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { validateUploadBuffer } from "@elkdonis/utils";
import { createUserFolder, getProxyFileUrl, getStorageSlug, resolveUserPath, uploadFile, uploadFilename } from "@elkdonis/services";
import { canEditAbout } from "@/lib/about-content";

const MAX_IMAGE_MB = 25;
const MAX_VIDEO_MB = 250;

/**
 * Media for the About page's sections (an image or a video beside a header).
 * Owners of the marketplace org and network admins only. Stored in the
 * uploader's EAC_Network/users/<slug>/Media/{Images,Videos}/ tree: no
 * `Private/` segment, so the public page can serve it.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = session.user.db_user_id ?? session.user.id;
    if (!(await canEditAbout(userId))) return NextResponse.json({ error: "Only the site's owners can upload here." }, { status: 403 });

    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    const isVideo = file.type.startsWith("video/");
    if (!isVideo && !file.type.startsWith("image/")) return NextResponse.json({ error: "Upload an image or a video." }, { status: 400 });
    const maxMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (file.size > maxMb * 1024 * 1024) return NextResponse.json({ error: `The file must be smaller than ${maxMb} MB.` }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateUploadBuffer(buffer, [isVideo ? "video" : "image"]);
    if (!validation.ok) return NextResponse.json({ error: "reason" in validation ? validation.reason : "Rejected" }, { status: 415 });

    const slug = await getStorageSlug(userId);
    if (!slug) return NextResponse.json({ error: "Your account has no storage folder yet." }, { status: 500 });
    const folder = isVideo ? "Media/Videos" : "Media/Images";
    if (!(await createUserFolder(slug, folder))) return NextResponse.json({ error: "Could not prepare your storage folder." }, { status: 500 });
    const relativePath = resolveUserPath(slug, `${folder}/${uploadFilename(file.name, null)}`);
    if (!(await uploadFile(relativePath, buffer, file.type))) return NextResponse.json({ error: "Failed to upload file to storage." }, { status: 502 });
    return NextResponse.json({ url: getProxyFileUrl(relativePath), kind: isVideo ? "video" : "image" });
  } catch (error) {
    console.error("[art-auction about media] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
