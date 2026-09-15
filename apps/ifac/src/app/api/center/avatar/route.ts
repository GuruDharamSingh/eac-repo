import { NextResponse, type NextRequest } from "next/server";
import { getStorageSlug, uploadUserFile } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";

/**
 * A display image for the profile surface.
 *
 * Any signed-in person may upload here — /api/upload is editors-only because
 * it writes into IFAC's own storage, whereas this writes into the person's
 * OWN tree (`EAC_Network/users/<slug>/Media/Images/`). The returned URL is
 * what the surface saves as `avatarUrl`, for themselves or, if they are an
 * owner or guide, for IFAC's own identity row.
 */
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Images only" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Keep it under 8 MB" }, { status: 413 });

  const slug = await getStorageSlug(viewer.userId);
  if (!slug) return NextResponse.json({ error: "Your storage is not set up yet" }, { status: 409 });

  const result = await uploadUserFile(slug, "Images", file.name, new Uint8Array(await file.arrayBuffer()), file.type);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, url: result.url });
}
