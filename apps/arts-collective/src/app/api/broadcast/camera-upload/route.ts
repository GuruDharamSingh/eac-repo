import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@elkdonis/auth-server";
import { cameraUploadAbort, cameraUploadFinish, cameraUploadPart, cameraUploadStart } from "@elkdonis/services/obs";
import { getCurrentUser } from "@/lib/session";

/**
 * Camera recordings into the person's files, sent in parts while recording
 * (CameraPanel; Nextcloud chunking v2 in @elkdonis/services/obs):
 *   POST ?op=start  {name}             → {id, path}
 *   POST ?op=part&id=&index=  (bytes)  → {ok}   parts in order, 5–64 MB except the last
 *   POST ?op=finish&id=                → {path}
 *   POST ?op=abort&id=
 * Admins only while the broadcast area is; the upload id is bound to the person.
 */
const MAX_PART = 64_000_000;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await isAdmin(user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const q = request.nextUrl.searchParams;
  const op = q.get("op");
  const id = q.get("id") ?? "";
  try {
    if (op === "start") {
      const body = (await request.json().catch(() => ({}))) as { name?: string };
      return NextResponse.json(await cameraUploadStart(user.id, String(body.name ?? "")));
    }
    if (op === "part") {
      const index = Number(q.get("index"));
      const len = Number(request.headers.get("content-length") ?? 0);
      if (!Number.isInteger(index) || index < 1) return NextResponse.json({ error: "Bad part number" }, { status: 400 });
      if (len > MAX_PART) return NextResponse.json({ error: "Part too large" }, { status: 413 });
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > MAX_PART) return NextResponse.json({ error: "Part too large" }, { status: 413 });
      await cameraUploadPart(user.id, id, index, bytes);
      return NextResponse.json({ ok: true });
    }
    if (op === "finish") return NextResponse.json(await cameraUploadFinish(user.id, id));
    if (op === "abort") {
      await cameraUploadAbort(user.id, id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown op" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
