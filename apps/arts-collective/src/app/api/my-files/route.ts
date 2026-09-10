import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import {
  listUserFiles,
  uploadUserFile,
  deleteUserFile,
  getStorageSlug,
  USER_MEDIA_FOLDERS,
  type UserMediaFolder,
} from "@elkdonis/services";

/**
 * A person's own cloud storage, surfaced through the platform.
 *
 * Backed by EAC_Network/users/<slug>/ on Nextcloud, but the caller never sees
 * that: Nextcloud is the storage backend, not the product. Most people here
 * have no Nextcloud login at all — 35 have a folder, 9 have an account — so
 * this route is the only way they can reach their own files.
 *
 * The slug is never taken from the request. It is resolved from the session,
 * so a caller cannot address anyone else's storage no matter what they send;
 * the `path` parameter is only ever a path WITHIN their own folder, and
 * resolveUserPath throws if it tries to escape.
 */

const MAX_UPLOAD_MB = 100;

async function requireSlug() {
  const session = await getServerSession();
  const userId = session.user?.db_user_id ?? session.user?.id;
  if (!userId) return { error: "Unauthorized" as const, status: 401 };
  const slug = await getStorageSlug(userId);
  if (!slug) {
    // Every principal is given a slug at signup (migration 100). A missing one
    // means the row predates that and was never backfilled.
    return { error: "No storage is set up for this account" as const, status: 409 };
  }
  return { slug };
}

export async function GET(request: NextRequest) {
  const auth = await requireSlug();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const path = request.nextUrl.searchParams.get("path") ?? "";
  try {
    return NextResponse.json({ path, files: await listUserFiles(auth.slug, path) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSlug();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const form = await request.formData();
  const file = form.get("file");
  const folderRaw = String(form.get("folder") ?? "Images");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!USER_MEDIA_FOLDERS.includes(folderRaw as UserMediaFolder)) {
    return NextResponse.json(
      { error: `folder must be one of ${USER_MEDIA_FOLDERS.join(", ")}` },
      { status: 400 }
    );
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `Files must be under ${MAX_UPLOAD_MB}MB` },
      { status: 413 }
    );
  }

  const result = await uploadUserFile(
    auth.slug,
    folderRaw as UserMediaFolder,
    file.name,
    Buffer.from(await file.arrayBuffer()),
    file.type || undefined
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ success: true, url: result.url, path: result.path });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSlug();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }
  const result = await deleteUserFile(auth.slug, path);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
