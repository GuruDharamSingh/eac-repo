import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { validateUploadBuffer } from "@elkdonis/utils";
import { getServerSession } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";
import { uploadFile, getProxyFileUrl } from "@elkdonis/services";
import { getAdminClient, ensureUserFolder } from "@elkdonis/nextcloud";
import { nanoid } from "nanoid";
import { canManageIfac } from "@/lib/data";
import { siteConfig } from "@/config/site";

const ORG_ID = siteConfig.orgId;
const MAX_SIZE_MB = 25;

/**
 * Uploads one image into the artist's own folder
 * (EAC_Network/users/<memberSlug>/Media/Images/...).
 *
 * Not under EAC_Network/ifac/: a portrait and a body of work belong to the
 * artist and follow them across every org that publishes them, whereas the
 * org tree holds what IFAC itself publishes. `memberSlug` is users.slug,
 * which is also the folder name and the profile URL.
 *
 * `target` ("gallery", default, or "avatar") decides what a successful
 * upload does to the member's row once it resolves — a plain "return me a
 * URL" response either way, but "gallery" appends to `users.portfolio`
 * (directory.ts reads this as `artworks`) while "avatar" does not, it only
 * records the `media` row. Before this distinction existed, EVERY upload
 * unconditionally appended to portfolio — so uploading a portrait through
 * the admin form was silently also adding a duplicate entry to the artist's
 * artwork grid. Callers that only want a URL back (e.g. setting
 * portrait_url themselves) should pass target=avatar.
 *
 * Two authorization modes, distinguished by whether `memberSlug` resolves
 * to an existing roster row:
 *   - Existing member (self-serve or editing a live profile): authorised
 *     for org editors or the member themself — "the artist can always edit
 *     their own page" extends to uploading their own work, not just text
 *     fields.
 *   - No matching member yet (admin composing a brand-new profile before
 *     it's saved — see directory-manager.tsx's "Create profile" flow):
 *     uploads under the intended slug and just returns the URL, admin-only,
 *     no DB row to attach to yet.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const memberSlug = String(formData.get("memberSlug") ?? "").trim();
    const target = formData.get("target") === "avatar" ? "avatar" : "gallery";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!memberSlug) return NextResponse.json({ error: "memberSlug is required" }, { status: 400 });

    const [member] = await db<{ id: string }[]>`
      SELECT u.id FROM org_profiles op JOIN users u ON u.id = op.user_id
      WHERE op.org_id = ${ORG_ID} AND u.slug = ${memberSlug}
      LIMIT 1
    `;

    const isEditor = await canManageIfac(session);
    if (!member) {
      // Staging upload for a profile that doesn't exist yet — admin-only,
      // since there's no "self" to check ownership against.
      if (!isEditor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    } else {
      const viewerId = session.user.db_user_id ?? session.user.id;
      if (!isEditor && viewerId !== member.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || "unknown"}` }, { status: 400 });
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File size must be less than ${MAX_SIZE_MB}MB` }, { status: 400 });
    }

    // An artist's portrait and artwork belong to the artist, not to IFAC, so
    // they live under EAC_Network/users/<slug>/ and follow the person across
    // every org they're published on. The old per-org location
    // (EAC_Network/ifac/Media/Images/<slug>/) has been migrated and emptied —
    // writing there again would rebuild the split this replaced.
    const memberFolder = await ensureUserFolder(getAdminClient(), memberSlug);

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${timestamp}-${sanitizedName}`;
    const relativePath = `${memberFolder}/Media/Images/${filename}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // The client-supplied MIME type above is attacker-controlled, and
    // `image/svg+xml` passes a `startsWith("image/")` check. An SVG is a
    // script container, so verify the actual leading bytes — validateUploadBuffer
    // classifies SVG as its own kind, never `image`.
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

    if (member) {
      await db`
        INSERT INTO media (id, org_id, uploaded_by, nextcloud_file_id, nextcloud_path, url, type, filename, size_bytes, mime_type)
        VALUES (${mediaId}, ${ORG_ID}, ${member.id}, ${filename}, ${relativePath}, ${fileUrl}, 'image', ${file.name}, ${file.size}, ${file.type})
      `;
      if (target === "gallery") {
        await db`
          UPDATE users SET portfolio = portfolio || ${db.json([{ id: mediaId, url: fileUrl, title: file.name }])}, updated_at = NOW()
          WHERE id = ${member.id}
        `;
      }
    }

    return NextResponse.json({ success: true, id: mediaId, url: fileUrl, filename: file.name, size: file.size });
  } catch (error) {
    console.error("[ifac] upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
