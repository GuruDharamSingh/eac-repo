import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@elkdonis/nextcloud";
import { requireUser } from "@/lib/session";

const LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024,  // 10 MB
  video: 500 * 1024 * 1024, // 500 MB
};

function mediaKind(mime: string): "image" | "video" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return null;
}

export async function POST(request: NextRequest) {
  await requireUser();

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const orgSlug = formData.get("orgSlug") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!orgSlug) {
    return NextResponse.json({ error: "orgSlug required" }, { status: 400 });
  }

  const kind = mediaKind(file.type);
  if (!kind) {
    return NextResponse.json({ error: "Images and videos only" }, { status: 400 });
  }
  if (file.size > LIMITS[kind]) {
    const mb = LIMITS[kind] / 1024 / 1024;
    return NextResponse.json({ error: `Max ${mb} MB for ${kind}s` }, { status: 413 });
  }

  let admin;
  try {
    admin = getAdminClient();
  } catch {
    return NextResponse.json({ error: "Nextcloud not configured" }, { status: 500 });
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${timestamp}-${safeName}`;
  const subfolder = kind === "image" ? "covers" : "videos";
  const folderPath = `EAC_Network/${orgSlug}/Workshops/${subfolder}`;
  const filePath = `${folderPath}/${filename}`;

  // Ensure folder tree exists
  const parts = folderPath.split("/");
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    try {
      await admin.webdav.createDirectory(current);
    } catch {
      // already exists — ignore
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    await admin.webdav.putFileContents(`/${filePath}`, buffer, {
      overwrite: true,
      contentLength: buffer.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Upload to Nextcloud failed", detail: String(err) },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: `/api/media/${filePath}` });
}
