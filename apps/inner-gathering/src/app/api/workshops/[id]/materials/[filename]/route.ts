import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { db } from "@elkdonis/db";

/**
 * GET /api/workshops/[id]/materials/[filename]
 *
 * Streams a single file out of the workshop's materials folder — so
 * attendees can download it directly from the app instead of being sent
 * into the general Nextcloud Files UI. Same access rule as the listing
 * route (author, org owner/guide, or enrolled attendee).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params;
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
    const { getAdminClient, getWorkshopMaterialsPath, downloadFile, listWorkshopMaterials } =
      await import("@elkdonis/nextcloud");
    const serviceClient = getAdminClient();
    const materialsPath = getWorkshopMaterialsPath(thread.org_id, id);

    // Look up the real mime type from the listing rather than guessing —
    // the filename param is decoded by Next.js but the folder is the source
    // of truth for what's actually in it.
    const files = await listWorkshopMaterials(serviceClient, thread.org_id, id);
    const file = files.find((f) => f.filename === filename);
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const buffer = await downloadFile(serviceClient, `${materialsPath}/${filename}`);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    console.error("[workshops/materials/download] failed:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
