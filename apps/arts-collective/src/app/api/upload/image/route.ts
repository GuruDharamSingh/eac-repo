import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@elkdonis/nextcloud";
import { validateUploadBuffer } from "@elkdonis/utils";
import { hasOrgRole } from "@elkdonis/services";
import { isAdmin } from "@elkdonis/auth-server";
import { getCurrentUser } from "@/lib/session";
import { getOrgBySlug } from "@/lib/org";

const LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024,  // 10 MB
  video: 500 * 1024 * 1024, // 500 MB
};

function mediaKind(mime: string): "image" | "video" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return null;
}

export async function POST(request: NextRequest) {
  // getCurrentUser, not requireUser: this route is called by fetch (the
  // media-upload embed), and a 302 to /login is not something a fetch caller
  // can act on. Return the status instead.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to upload" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const orgSlug = formData.get("orgSlug") as string | null;
  // "workshops" preserves the exact path this route has always written to
  // for its original caller (workshop cover uploads); a new caller passes
  // its own context (e.g. "directory" for associated-organization logos)
  // rather than forking a second upload route for the same Nextcloud logic.
  const context = (formData.get("context") as string | null) || "workshops";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!orgSlug) {
    return NextResponse.json({ error: "orgSlug required" }, { status: 400 });
  }

  // Authentication alone is not enough: orgSlug is caller-supplied and decides
  // which org's Nextcloud folder gets written to. Without this check any signed-in
  // user could upload into any org on the network.
  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    return NextResponse.json({ error: "Unknown organisation" }, { status: 404 });
  }
  // A network steward managing the associated-organizations console isn't
  // necessarily a member of every org they're uploading a logo for.
  const permitted =
    (await isAdmin(user.id)) || (await hasOrgRole(user.id, org.id, ["owner", "guide", "member"]));
  if (!permitted) {
    return NextResponse.json(
      { error: "You are not a member of this organisation" },
      { status: 403 }
    );
  }

  const kind = mediaKind(file.type);
  if (!kind) {
    return NextResponse.json({ error: "Images and videos only" }, { status: 400 });
  }
  if (file.size > LIMITS[kind]) {
    const mb = LIMITS[kind] / 1024 / 1024;
    return NextResponse.json({ error: `Max ${mb} MB for ${kind}s` }, { status: 413 });
  }

  let admin;
  try {
    admin = getAdminClient();
  } catch {
    return NextResponse.json({ error: "Nextcloud not configured" }, { status: 500 });
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${timestamp}-${safeName}`;
  const subfolder = kind === "image" ? "covers" : "videos";
  const contextFolder = context === "workshops" ? "Workshops" : context;
  const folderPath = `EAC_Network/${orgSlug}/${contextFolder}/${subfolder}`;
  const filePath = `${folderPath}/${filename}`;

  // Ensure folder tree exists
  const parts = folderPath.split("/");
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    try {
      await admin.webdav.createDirectory(current);
    } catch {
      // already exists — ignore
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Verify the actual bytes match the declared category — the client MIME
  // type is attacker-controlled.
  const validation = validateUploadBuffer(buffer, [kind]);
  if (!validation.ok) {
    // `in` rather than `validation.reason`: UploadValidation is a true
    // discriminated union, which this codebase repeatedly finds does not
    // narrow on `if (!x.ok)` — same quirk as profiles.ts's SaveResult note.
    return NextResponse.json(
      { error: "reason" in validation ? validation.reason : "Rejected" },
      { status: 415 }
    );
  }

  try {
    await admin.webdav.putFileContents(`/${filePath}`, buffer, {
      overwrite: true,
      contentLength: buffer.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Upload to Nextcloud failed", detail: String(err) },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: `/api/media/${filePath}` });
}
