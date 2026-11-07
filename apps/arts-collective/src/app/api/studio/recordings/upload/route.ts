import { NextRequest, NextResponse } from "next/server";
import { recordingUploadAbort, recordingUploadFinish, recordingUploadPart, recordingUploadStart } from "@elkdonis/services/recordings";
import { getCurrentUser } from "@/lib/session";

/**
 * A recording into the signed-in person's Private/Video/Recordings, sent in
 * parts while it records (@elkdonis/studio/capture, chunked):
 *   POST ?op=start  {name}             → {id, path}
 *   POST ?op=part&id=&index=  (bytes)  → {ok}   in order, 5–64 MB except the last
 *   POST ?op=finish&id=                → {path}
 *   POST ?op=abort&id=
 * The upload id is bound to the person (@elkdonis/services/recordings).
 */
const MAX_PART = 64_000_000;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const id = q.get("id") ?? "";
  try {
    switch (q.get("op")) {
      case "start": {
        const body = (await request.json().catch(() => ({}))) as { name?: string };
        return NextResponse.json(await recordingUploadStart(user.id, String(body.name ?? ""), "Recordings"));
      }
      case "part": {
        const index = Number(q.get("index"));
        if (!Number.isInteger(index) || index < 1) return NextResponse.json({ error: "Bad part number" }, { status: 400 });
        if (Number(request.headers.get("content-length") ?? 0) > MAX_PART) return NextResponse.json({ error: "Part too large" }, { status: 413 });
        const bytes = await request.arrayBuffer();
        if (bytes.byteLength > MAX_PART) return NextResponse.json({ error: "Part too large" }, { status: 413 });
        await recordingUploadPart(user.id, id, index, bytes);
        return NextResponse.json({ ok: true });
      }
      case "finish":
        return NextResponse.json(await recordingUploadFinish(user.id, id));
      case "abort":
        await recordingUploadAbort(user.id, id);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Unknown op" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
