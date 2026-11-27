import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { uploadTo } from "@/lib/media-picker";

/**
 * POST /api/media/upload-to (multipart: file, destination = JSON) (2026-11-26).
 *
 * An upload from the picker, filed in the destination's folder under its context name (`pont-neuf-2026-11-26-01.jpg`);
 * pictures are re-encoded without metadata. No destination: Media/Images under the file's own name. Content is
 * sniffed (validateUploadBuffer), SVG refused, 25 MB cap. Owners and guides only.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const file = form.get("file");
  let destination: unknown = null;
  try {
    const raw = form.get("destination");
    destination = typeof raw === "string" && raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ error: "Bad destination." }, { status: 400 });
  }
  const r = await uploadTo(await getViewer(), file instanceof File ? file : null, destination);
  if (r.ok === false) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.value);
}
