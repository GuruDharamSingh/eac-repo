import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import {
  davListDeep,
  resolveUserPath,
  userStorageRoot,
  listUserFiles,
  uploadUserFile,
  deleteUserFile,
  getStorageSlug,
  USER_MEDIA_FOLDERS,
  type UserMediaFolder,
} from "@elkdonis/services";
import { validateUploadBuffer, type SniffedKind } from "@elkdonis/utils";

const KIND_EXT: Record<string, RegExp> = {
  image: /\.(png|jpe?g|webp|gif|svg|avif)$/i,
  video: /\.(mp4|m4v|mov|webm|mkv)$/i,
  audio: /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i,
};

function kindOf(name: string, mime: string | null): string | null {
  const m = mime?.split("/")[0];
  if (m === "image" || m === "video" || m === "audio") return m;
  return Object.keys(KIND_EXT).find((k) => KIND_EXT[k].test(name)) ?? null;
}

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

/** What each bucket accepts, checked against the bytes, not the declared type. */
const FOLDER_KINDS: Record<UserMediaFolder, SniffedKind[]> = {
  Images: ["image"],
  Audio: ["audio"],
  Videos: ["video"],
  Documents: ["document"],
};

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
  const params = request.nextUrl.searchParams;
  // MediaBrowser appends its own `path` (a full storage path from a folder it
  // was shown) after any `path` the host put in the endpoint, so the last one
  // wins, and a full path is turned back into one relative to the person's
  // folder. Before this, opening a folder re-listed the starting folder.
  const root = `${userStorageRoot(auth.slug)}/`;
  const raw = params.getAll("path").filter(Boolean).pop() ?? "";
  const path = raw.startsWith(root) ? raw.slice(root.length) : raw;
  // `kind`: image | video | audio keeps folders and only files of that kind.
  const kind = params.get("kind");
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const keep = (f: { isFolder: boolean; name: string; mimeType: string | null }) =>
    f.isFolder || !kind || kindOf(f.name, f.mimeType) === kind;
  try {
    if (q) {
      // Search: every file under the current folder whose name matches.
      const all = await davListDeep(resolveUserPath(auth.slug, path), 3000);
      return NextResponse.json({
        path,
        browsable: true,
        files: all.filter((f) => f.name.toLowerCase().includes(q) && keep(f)).slice(0, 200),
      });
    }
    // `browsable`: the entries include folders the picker may open.
    return NextResponse.json({
      path,
      browsable: true,
      files: (await listUserFiles(auth.slug, path)).filter(keep),
    });
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

  const buffer = Buffer.from(await file.arrayBuffer());
  // The client MIME type is caller-controlled; check the bytes.
  const validation = validateUploadBuffer(buffer, FOLDER_KINDS[folderRaw as UserMediaFolder], {
    allowText: folderRaw === "Documents",
  });
  if (!validation.ok) {
    // `in` rather than `validation.reason`: the union does not narrow on
    // `!validation.ok` under `strict: false` (same as api/upload/image).
    return NextResponse.json(
      { error: "reason" in validation ? validation.reason : "Rejected" },
      { status: 415 }
    );
  }

  const result = await uploadUserFile(
    auth.slug,
    folderRaw as UserMediaFolder,
    file.name,
    buffer,
    "sniffed" in validation ? validation.sniffed.mime : file.type || undefined
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
