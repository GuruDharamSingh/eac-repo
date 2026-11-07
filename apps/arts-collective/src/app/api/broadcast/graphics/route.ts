import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@elkdonis/auth-server";
import { obsGraphicsUpload } from "@elkdonis/services/obs";
import { getCurrentUser } from "@/lib/session";

/**
 * Upload an OGraf graphic folder to the server's OBS (GraphicsPanel, "Upload
 * a graphic folder"). Admins only, and only from the tab that holds the
 * studio's lease: the holder is rebuilt from the session and the tab id.
 * Form fields: `tabId`, `folder`, then pairs of `path` (relative to the
 * folder) and `file`. The agent checks names, file types and the 25 MB cap,
 * and refuses a folder without a usable `*.ograf.json`. The graphic's code
 * runs in OBS's browser source, which is why this stays admin-only.
 */
const MAX_BYTES = 25_000_000;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await isAdmin(user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send the folder as a form" }, { status: 400 });
  const tabId = String(form.get("tabId") ?? "");
  const folder = String(form.get("folder") ?? "");
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(tabId)) return NextResponse.json({ error: "Bad tab" }, { status: 400 });

  const paths = form.getAll("path").map(String);
  const blobs = form.getAll("file").filter((f): f is File => typeof f !== "string");
  if (!paths.length || paths.length !== blobs.length) return NextResponse.json({ error: "No files" }, { status: 400 });
  let total = 0;
  const files: { path: string; data: string }[] = [];
  for (let i = 0; i < blobs.length; i++) {
    total += blobs[i].size;
    if (total > MAX_BYTES) return NextResponse.json({ error: "More than 25 MB" }, { status: 413 });
    files.push({ path: paths[i], data: Buffer.from(await blobs[i].arrayBuffer()).toString("base64") });
  }
  try {
    const view = await obsGraphicsUpload(`${user.id}:${tabId}`, folder, files);
    return NextResponse.json({ ok: true, graphics: view.catalog.filter((g) => g.source === "uploads" && g.folder === folder).map((g) => g.name) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
