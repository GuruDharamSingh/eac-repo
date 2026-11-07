import { NextRequest, NextResponse } from "next/server";
import { captureMark, captureUploadFinish, captureUploadPart, captureUploadStart } from "@elkdonis/services/recordings";

/**
 * Phone capture, the phone's side (/c/<code>, PhoneCapture). No session: the
 * code is the credential (8 characters, 30 minutes, one recording), and the
 * file goes to the Recordings folder of whoever made the code.
 *   POST ?op=recording | failed         status for the computer
 *   POST ?op=start&ext=webm|mp4
 *   POST ?op=part&index=  (bytes)
 *   POST ?op=finish&seconds=
 */
const MAX_PART = 64_000_000;

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const q = request.nextUrl.searchParams;
  try {
    switch (q.get("op")) {
      case "recording":
      case "failed":
        captureMark(code, q.get("op") as "recording" | "failed", q.get("error")?.slice(0, 200));
        return NextResponse.json({ ok: true });
      case "start":
        await captureUploadStart(code, q.get("ext") === "mp4" ? "mp4" : "webm");
        return NextResponse.json({ ok: true });
      case "part": {
        const index = Number(q.get("index"));
        if (!Number.isInteger(index) || index < 1) return NextResponse.json({ error: "Bad part number" }, { status: 400 });
        if (Number(request.headers.get("content-length") ?? 0) > MAX_PART) return NextResponse.json({ error: "Part too large" }, { status: 413 });
        const bytes = await request.arrayBuffer();
        if (bytes.byteLength > MAX_PART) return NextResponse.json({ error: "Part too large" }, { status: 413 });
        await captureUploadPart(code, index, bytes);
        return NextResponse.json({ ok: true });
      }
      case "finish": {
        const seconds = Number(q.get("seconds"));
        return NextResponse.json(await captureUploadFinish(code, Number.isFinite(seconds) ? seconds : null));
      }
      default:
        return NextResponse.json({ error: "Unknown op" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
