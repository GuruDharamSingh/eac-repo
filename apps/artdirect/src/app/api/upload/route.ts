import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { uploadFile, getProxyFileUrl, getProfileBySlug, canEditProfile, updateProfile } from "@elkdonis/services";
import { getAdminClient, ensurePersonMediaFolder } from "@elkdonis/nextcloud";
import { getCurrentUser } from "@/lib/session";

const MAX_SIZE_MB = 25;

/**
 * Uploads one image into a person's ArtDirect media folder
 * (EAC_Network/artdirect/Media/Images/<slug>/...).
 *
 * Mirrors apps/ifac/src/app/api/upload/route.ts, simplified: ArtDirect isn't
 * org-scoped, so there's no org-roster lookup and no `media` table row (that
 * table's org_id is a real FK to `organizations`, and ArtDirect isn't one) —
 * just the Nextcloud upload, returning a URL, and (for target=gallery)
 * appending straight to users.portfolio.
 *
 * `target` ("gallery", default, or "avatar") decides what a successful
 * upload does to the profile once it resolves — "gallery" appends to
 * users.portfolio, "avatar" only returns the URL (the caller sets
 * avatarUrl itself via saveAvatarAction).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const slug = String(formData.get("slug") ?? "").trim();
    const target = formData.get("target") === "avatar" ? "avatar" : "gallery";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });

    const profile = await getProfileBySlug(slug);
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const allowed = await canEditProfile(user.id, profile.userId);
    if (!allowed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || "unknown"}` }, { status: 400 });
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File size must be less than ${MAX_SIZE_MB}MB` }, { status: 400 });
    }

    await ensurePersonMediaFolder(getAdminClient(), slug);

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${timestamp}-${sanitizedName}`;
    const relativePath = `EAC_Network/artdirect/Media/Images/${slug}/${filename}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadSuccess = await uploadFile(relativePath, buffer, file.type);
    if (!uploadSuccess) {
      return NextResponse.json({ error: "Failed to upload file to Nextcloud" }, { status: 500 });
    }

    const fileUrl = getProxyFileUrl(relativePath);

    if (target === "gallery") {
      await updateProfile(profile.userId, {
        portfolio: [...profile.portfolio, { url: fileUrl, title: file.name }],
      });
    }

    return NextResponse.json({ success: true, url: fileUrl, filename: file.name, size: file.size });
  } catch (error) {
    console.error("[artdirect] upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
