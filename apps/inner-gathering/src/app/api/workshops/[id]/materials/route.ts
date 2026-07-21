import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";

/**
 * GET /api/workshops/[id]/materials
 *
 * Lists the workshop's materials folder (service-account view). Access:
 * the author, org owners/guides, or enrolled users (RSVP yes / paid join).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [thread] = await db`
    SELECT author_id, org_id FROM threads
    WHERE id = ${id} AND kind = 'workshop'
    LIMIT 1
  `;
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAuthor = thread.author_id === userId;
  let allowed = isAuthor;
  if (!allowed) {
    const [access] = await db`
      SELECT 1 FROM thread_rsvps
      WHERE thread_id = ${id} AND user_id = ${userId} AND status = 'yes'
      UNION ALL
      SELECT 1 FROM workshop_join_requests
      WHERE workshop_id = ${id} AND user_id = ${userId} AND status = 'paid'
      UNION ALL
      SELECT 1 FROM user_organizations
      WHERE user_id = ${userId} AND org_id = ${thread.org_id}
        AND role IN ('owner', 'guide')
      LIMIT 1
    `;
    allowed = Boolean(access);
  }
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { getAdminClient, listWorkshopMaterials, ensureWorkshopMaterialsFolder } =
      await import("@elkdonis/nextcloud");
    const serviceClient = getAdminClient();
    if (isAuthor) {
      // Authors may hit this before the folder exists (older workshops)
      await ensureWorkshopMaterialsFolder(serviceClient, thread.org_id, id).catch(() => {});
    }
    const files = await listWorkshopMaterials(serviceClient, thread.org_id, id);
    return NextResponse.json({
      files: files.map((f) => ({
        name: f.filename,
        size: f.size,
        mimeType: f.mimeType ?? null,
        lastModified: f.lastModified ?? null,
      })),
      isAuthor,
    });
  } catch (err) {
    console.error("[workshops/materials] listing failed:", err);
    // Folder may not exist yet — present as empty rather than an error
    return NextResponse.json({ files: [], isAuthor });
  }
}

const MAX_MATERIAL_SIZE = 200 * 1024 * 1024; // 200MB

/**
 * POST /api/workshops/[id]/materials
 *
 * Uploads a file into the workshop's materials folder. Author (or org
 * owner/guide) only — enrolled attendees get read-only access to the folder
 * itself, not this endpoint.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [thread] = await db`
    SELECT author_id, org_id FROM threads
    WHERE id = ${id} AND kind = 'workshop'
    LIMIT 1
  `;
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAuthor = thread.author_id === userId;
  let allowed = isAuthor;
  if (!allowed) {
    const [access] = await db`
      SELECT 1 FROM user_organizations
      WHERE user_id = ${userId} AND org_id = ${thread.org_id}
        AND role IN ('owner', 'guide')
      LIMIT 1
    `;
    allowed = Boolean(access);
  }
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (file.size > MAX_MATERIAL_SIZE) {
    return NextResponse.json(
      { error: `File too large. Max size: ${MAX_MATERIAL_SIZE / 1024 / 1024}MB` },
      { status: 413 }
    );
  }

  try {
    const { getAdminClient, ensureWorkshopMaterialsFolder, getWorkshopMaterialsPath, uploadFile } =
      await import("@elkdonis/nextcloud");
    const serviceClient = getAdminClient();
    await ensureWorkshopMaterialsFolder(serviceClient, thread.org_id, id);
    const materialsPath = getWorkshopMaterialsPath(thread.org_id, id);
    await uploadFile(serviceClient, file, { orgPath: materialsPath });
    return NextResponse.json({ success: true, filename: file.name });
  } catch (err) {
    console.error("[workshops/materials] upload failed:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
