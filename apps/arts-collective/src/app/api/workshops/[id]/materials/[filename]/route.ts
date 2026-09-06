import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import { canEditOrgIdentity, isEnrolledInWorkshop } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * GET /api/workshops/[id]/materials/[filename]
 *
 * Streams one file out of a workshop's Nextcloud materials folder so
 * participants download it from the workshop page rather than being sent into
 * the Nextcloud Files UI.
 *
 * The gate is here, not only on the page that links to it — a materials URL
 * must not be guessable. Same rule as the workspace: enrolled, or running the
 * org.
 *
 * Path traversal is handled by construction: the filename is matched against
 * the folder's own listing and anything not found there is a 404, so `..`
 * segments can never reach `downloadFile`.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [thread] = await db<Array<{ author_id: string | null; org_id: string }>>`
    SELECT author_id, org_id FROM threads
    WHERE id = ${id} AND kind = 'workshop'
    LIMIT 1
  `;
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed =
    thread.author_id === user.id ||
    (await isEnrolledInWorkshop(id, user.id)) ||
    (await canEditOrgIdentity(user.id, thread.org_id));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { getAdminClient, getWorkshopMaterialsPath, downloadFile, listWorkshopMaterials } =
      await import("@elkdonis/nextcloud");
    const client = getAdminClient();

    // The folder listing is the source of truth for what exists and for the
    // real mime type; don't guess either from the URL.
    const files = await listWorkshopMaterials(client, thread.org_id, id);
    const file = files.find((f) => f.filename === filename);
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const buffer = await downloadFile(
      client,
      `${getWorkshopMaterialsPath(thread.org_id, id)}/${filename}`
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    console.error(`[arts-collective] workshop material ${id}/${filename}:`, err);
    return NextResponse.json({ error: "Could not read that file" }, { status: 500 });
  }
}
