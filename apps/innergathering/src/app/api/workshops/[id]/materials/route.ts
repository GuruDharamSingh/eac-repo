import { Buffer } from "node:buffer";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@elkdonis/db";
import {
  canAccessWorkshopMaterials,
  deleteWorkshopMaterial,
  listWorkshopMaterials,
  uploadWorkshopMaterial,
} from "@elkdonis/services";
import { validateUploadBuffer } from "@elkdonis/utils";
import { getApiEditor, getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * A workshop's materials folder, as an API.
 *
 *   GET     the files, for anyone who may open them (author, enrolled, editor)
 *   POST    one file, multipart `file` — editors only
 *   DELETE  `?name=` — editors only
 *
 * Downloading is not here: the listing hands back `/api/media/...` URLs and
 * the media proxy applies the same enrolment rule, so there is one gate, in
 * @elkdonis/services, not two that can drift.
 */

const MAX_BYTES = 50 * 1024 * 1024;

async function workshopInThisOrg(id: string): Promise<boolean> {
  const [row] = await db<{ id: string }[]>`
    SELECT id FROM threads
    WHERE id = ${id} AND org_id = ${siteConfig.orgId} AND kind = 'workshop'
    LIMIT 1
  `;
  return Boolean(row);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!(await workshopInThisOrg(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessWorkshopMaterials(viewer.userId, siteConfig.orgId, id))) {
    return NextResponse.json({ error: "Join the workshop to open its materials" }, { status: 403 });
  }
  return NextResponse.json({ files: await listWorkshopMaterials(siteConfig.orgId, id) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!(await workshopInThisOrg(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Keep files under 50MB" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  // The bytes decide what this is, not the client's MIME string: an SVG or
  // an HTML file named .pdf is a script container and never gets stored.
  const validation = validateUploadBuffer(buffer, ["image", "audio", "video", "document"], {
    allowText: file.type === "text/plain" || /\.(txt|md)$/i.test(file.name),
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: "reason" in validation ? validation.reason : "That file type is not accepted" },
      { status: 415 }
    );
  }

  const saved = await uploadWorkshopMaterial(
    siteConfig.orgId,
    id,
    file.name,
    buffer,
    file.type || "application/octet-stream",
    editor.userId
  );
  if (!saved) return NextResponse.json({ error: "Could not store the file" }, { status: 502 });
  return NextResponse.json({ file: saved });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const editor = await getApiEditor();
  if (!editor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!(await workshopInThisOrg(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const name = request.nextUrl.searchParams.get("name") ?? "";
  const ok = await deleteWorkshopMaterial(siteConfig.orgId, id, name);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Could not remove that file" }, { status: 400 });
}
