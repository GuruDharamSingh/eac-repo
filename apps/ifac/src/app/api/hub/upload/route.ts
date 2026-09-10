import { folderForMime, uploadOrgFile } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * Upload into the group's shared drive.
 *
 * Distinct from /api/upload, which is images-only and writes into a person's
 * OWN folder (`EAC_Network/users/<slug>/`) for portraits and portfolio work.
 * A shared drive needs neither restriction: a group's files are documents,
 * audio and video as often as images, and they belong to the org's tree.
 *
 * Any member may add a file. That is the point of a shared drive — the
 * asymmetry with deleting (owners and guides only, in ./files) is deliberate:
 * adding is additive and reversible, removing is neither.
 */
export const dynamic = "force-dynamic";

/** Per-type ceilings, matching the shared blog-server media rules. */
const MAX_BYTES: Record<string, number> = {
  image: 25 * 1024 * 1024,
  audio: 150 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  document: 50 * 1024 * 1024,
};

function kindOf(mime: string): keyof typeof MAX_BYTES {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

export async function POST(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected a file upload" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  const limit = MAX_BYTES[kindOf(mime)];
  if (file.size > limit) {
    return Response.json(
      { error: `That file is over the ${Math.round(limit / 1024 / 1024)}MB limit` },
      { status: 413 }
    );
  }

  // A caller may name the destination folder, but it is still resolved inside
  // the org root. When they don't, the file is filed by type the same way
  // every other upload path in the network files things.
  const requested = String(form.get("path") ?? "").trim();
  const folder = requested || `Media/${folderForMime(mime)}`;

  try {
    const result = await uploadOrgFile(
      siteConfig.orgId,
      folder,
      file.name,
      new Uint8Array(await file.arrayBuffer()),
      mime,
      viewer.userId
    );
    if (!result) {
      return Response.json({ error: "Upload failed" }, { status: 502 });
    }
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[ifac] hub/upload:", error);
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }
}
