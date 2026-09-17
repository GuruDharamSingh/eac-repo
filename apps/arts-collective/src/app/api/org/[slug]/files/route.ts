import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import {
  listOrgFiles,
  uploadOrgFile,
  deleteOrgFile,
  getOrgRole,
  ORG_MEDIA_FOLDERS,
  type OrgMediaFolder,
} from "@elkdonis/services";
import { requireUser } from "@/lib/session";
import { canEditOrgSite } from "@/lib/org";

/**
 * An organisation's shared team folder, for the console's Files card.
 *
 * Speaks the FilesCard contract — GET `?path=`, POST a multipart upload,
 * DELETE `?path=` — so the same component can show a person's own storage and
 * their org's team folder as two sources in one switcher. A member should not
 * have to know which Nextcloud tree a file is in before they can look for it.
 *
 * NOT relying on the service for authorisation: `listOrgFiles` goes out over
 * the service account, which can read every org's tree. Membership is checked
 * here on every call, reads included, and the org id is resolved from the URL
 * slug rather than taken from the request body. Path containment is the
 * service's job — `resolveOrgPath` throws on anything trying to climb out of
 * the org root, which is answered as 400 rather than 500: the request is
 * malformed, the server is fine.
 */

export const dynamic = "force-dynamic";

const MAX_UPLOAD_MB = 100;

async function gate(slug: string) {
  const user = await requireUser();
  const rows = await db<{ id: string }[]>`
    SELECT id FROM organizations WHERE slug = ${slug} LIMIT 1
  `;
  const orgId = rows[0]?.id;
  if (!orgId) return { error: "Organization not found", status: 404 as const };
  // Any standing in the org at all, viewer included — reading the team folder
  // is what membership means here. `isOrgMember` in services is a different
  // thing: it takes a forum viewer, not a user id.
  const role = await getOrgRole(user.id, orgId);
  if (!role) {
    return { error: "Not a member of this organisation", status: 403 as const };
  }
  return { orgId, userId: user.id, canEdit: await canEditOrgSite(user.id, orgId) };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const auth = await gate(slug);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const path = request.nextUrl.searchParams.get("path") ?? "";
  try {
    const files = await listOrgFiles(auth.orgId, path);
    return NextResponse.json({ path, files, canEdit: auth.canEdit });
  } catch (error) {
    console.error("[arts-collective] org files list:", error);
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const auth = await gate(slug);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  // Reading the team folder is a member right; adding to it is not.
  if (!auth.canEdit) {
    return NextResponse.json(
      { error: "Only owners and guides can add to the team folder" },
      { status: 403 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was sent" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `Files must be under ${MAX_UPLOAD_MB}MB` },
      { status: 413 }
    );
  }

  const asked = String(form?.get("folder") ?? "Images");
  const folder: OrgMediaFolder = (ORG_MEDIA_FOLDERS as readonly string[]).includes(asked)
    ? (asked as OrgMediaFolder)
    : "Images";

  try {
    const result = await uploadOrgFile(
      auth.orgId,
      // FilesCard browses and uploads to `Media/<folder>`, so the two agree on
      // where a file just added will actually appear.
      `Media/${folder}`,
      file.name,
      new Uint8Array(await file.arrayBuffer()),
      file.type || "application/octet-stream",
      auth.userId
    );
    if (!result) {
      return NextResponse.json({ error: "Upload failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[arts-collective] org files upload:", error);
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const auth = await gate(slug);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.canEdit) {
    return NextResponse.json(
      { error: "Only owners and guides can remove team files" },
      { status: 403 }
    );
  }

  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!path) return NextResponse.json({ error: "A path is required" }, { status: 400 });

  try {
    const ok = await deleteOrgFile(auth.orgId, path);
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Could not delete that" }, { status: 400 });
  } catch (error) {
    console.error("[arts-collective] org files delete:", error);
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
}
