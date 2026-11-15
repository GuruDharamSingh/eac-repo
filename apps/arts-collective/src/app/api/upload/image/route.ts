import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@elkdonis/nextcloud";
import { validateUploadBuffer } from "@elkdonis/utils";
import { hasOrgRole, uploadFilename, uploadUserFile, getStorageSlug, PERSONAL_ORG_ID } from "@elkdonis/services";
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
  // From the form, or from the query string for a caller that cannot add
  // form fields (the page editor's picker posts only the file; its endpoint
  // carries `?orgSlug=&context=`, 2026-10-30).
  const query = request.nextUrl.searchParams;
  const orgSlug = (formData.get("orgSlug") as string | null) || query.get("orgSlug");
  // "workshops" preserves the exact path this route has always written to
  // for its original caller (workshop cover uploads); a new caller passes
  // its own context (e.g. "directory" for associated-organization logos)
  // rather than forking a second upload route for the same Nextcloud logic.
  const context = (formData.get("context") as string | null) || query.get("context") || "workshops";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!orgSlug) {
    return NextResponse.json({ error: "orgSlug required" }, { status: 400 });
  }
  // `context` becomes one folder name under the org's root. It is
  // caller-supplied, so it must be a single plain segment: a value such as
  // "../<other org>/Media/Images" would otherwise be resolved by the HTTP
  // client and write into another org's or person's tree (2026-11-11).
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(context)) {
    return NextResponse.json({ error: "Invalid context" }, { status: 400 });
  }

  // Authentication alone is not enough: orgSlug is caller-supplied and decides
  // which org's Nextcloud folder gets written to. Without this check any signed-in
  // user could upload into any org on the network.
  const org = await getOrgBySlug(orgSlug);
  if (!org) {
    return NextResponse.json({ error: "Unknown organisation" }, { status: 404 });
  }

  // "Just me" (the Studio's personal identity, org `oad`): the work is the
  // person's own, so it is filed in their own library, users/<folder>/Media/,
  // not in the network org's folder. Until 2026-11-11 it landed in
  // EAC_Network/oad/<context>/covers/, which only ArtDirect served.
  // docs/open/MEDIA_OWNERSHIP_AND_PLACEMENT_2026-11-11.md (phase 1).
  const personal = org.id === PERSONAL_ORG_ID;

  // A network steward managing the associated-organizations console isn't
  // necessarily a member of every org they're uploading a logo for. A personal
  // upload writes only to the uploader's own folder, so it needs no org role.
  const permitted =
    personal ||
    (await isAdmin(user.id)) ||
    (await hasOrgRole(user.id, org.id, ["owner", "guide", "member"]));
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

  if (personal) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateUploadBuffer(buffer, [kind]);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "reason" in validation ? validation.reason : "Rejected" },
        { status: 415 }
      );
    }
    const folder = await getStorageSlug(user.id);
    if (!folder) {
      return NextResponse.json({ error: "Your account has no storage folder yet" }, { status: 409 });
    }
    const title = String(formData.get("title") ?? "").trim().slice(0, 200);
    const result = await uploadUserFile(
      folder,
      kind === "image" ? "Images" : "Videos",
      uploadFilename(file.name, title || null),
      buffer,
      "sniffed" in validation ? validation.sniffed.mime : file.type
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Upload failed" }, { status: 502 });
    }
    return NextResponse.json({ url: result.url });
  }

  let admin;
  try {
    admin = getAdminClient();
  } catch {
    return NextResponse.json({ error: "Nextcloud not configured" }, { status: 500 });
  }

  // Named after the work when the surface sends a title, else after the
  // uploaded file. This address outlives the upload — it is what a stored
  // page, a gallery item and every <img src> carries. See uploadFilename.
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const filename = uploadFilename(file.name, title || null);
  const subfolder = kind === "image" ? "covers" : "videos";
  const contextFolder = context === "workshops" ? "Workshops" : context;
  // The org's id, not its slug: an org's library is EAC_Network/<org_id>/
  // (orgStorageRoot). Five orgs' slugs differ from their ids (inner_group is
  // `inner-gathering`, elkdonis is `arts-collective`, …), and files written
  // under the slug landed in a folder their own site did not serve
  // (2026-11-11; earlier uploads are still in those slug folders).
  const folderPath = `EAC_Network/${org.id}/${contextFolder}/${subfolder}`;
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
