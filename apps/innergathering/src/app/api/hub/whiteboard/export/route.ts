import { uploadOrgFile } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getApiMember } from "@/lib/auth";

/**
 * Save the whiteboard — the scene or an image of it — into the org's
 * Nextcloud folder instead of downloading it (owner, 2026-10-10).
 *
 * Same gate as the board itself: any member. Files land in
 * `EAC_Network/inner_group/Private/Whiteboards/`, timestamped by
 * `uploadOrgFile`. `Private/` because the board is members-only: a media path
 * without that segment is served to anonymous visitors.
 *
 * Only the three kinds the canvas produces are accepted. An SVG is served
 * back by /api/media as a download, never inline (media-serve.ts INLINE_SAFE),
 * so a hand-made SVG posted here cannot run in the site's origin.
 */
export const dynamic = "force-dynamic";

const FOLDER = "Private/Whiteboards";
const MAX_BYTES = 25 * 1024 * 1024;
const TYPES: Record<string, string> = {
  png: "image/png",
  svg: "image/svg+xml",
  excalidraw: "application/json",
};

export async function POST(request: Request) {
  const viewer = await getApiMember();
  if (!viewer) return Response.json({ error: "Members only" }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected a file" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "Expected a file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "That file is larger than 25 MB." }, { status: 413 });
  }

  const requested = String(form.get("name") ?? "Whiteboard.png").trim() || "Whiteboard.png";
  const ext = requested.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = TYPES[ext];
  if (!mimeType) {
    return Response.json({ error: "Only .png, .svg and .excalidraw files are saved here." }, { status: 400 });
  }

  const saved = await uploadOrgFile(
    siteConfig.orgId,
    FOLDER,
    requested,
    new Uint8Array(await file.arrayBuffer()),
    mimeType,
    viewer.userId
  ).catch((error) => {
    console.error("[whiteboard/export] upload failed:", error);
    return null;
  });
  if (!saved) return Response.json({ error: "Nextcloud did not take the file." }, { status: 502 });

  return Response.json({ ok: true, name: saved.name, path: saved.path });
}
