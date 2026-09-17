import { folderForMime, uploadOrgFile } from "@elkdonis/services";
import { validateUploadBuffer } from "@elkdonis/utils";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Upload into the circle's shared storage — the consolidated uploadOrgFile
 * path, not another hand-rolled WebDAV PUT.
 *
 * Editors only. This is the authoring upload behind /manage (a cover, the
 * side banner, the meeting handout, a recording). Files land in
 * EAC_Network/<org>/Media/<Images|Audio|Videos|Documents>, which is where
 * the home page reads from: a video uploaded here appears in the theatre,
 * an image on the shelf.
 */
export const dynamic = "force-dynamic";

const MAX_BYTES = {
  image: 25 * 1024 * 1024,
  audio: 150 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  document: 50 * 1024 * 1024,
} as const;

export async function POST(request: Request) {
  const editor = await getApiEditor();
  if (!editor) return Response.json({ error: "Not allowed" }, { status: 403 });

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

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Trust the CONTENT, not the client's Content-Type. SVG is deliberately
  // absent from the allowed kinds: it is a script container, and these files
  // are served back from this origin.
  const check = validateUploadBuffer(bytes, ["image", "audio", "video", "document"], {
    allowText: true,
  });
  // `in`, not `!check.ok`: the repo compiles with strict off, and without
  // strictNullChecks a boolean discriminant does not narrow the union.
  if ("reason" in check) {
    return Response.json({ error: check.reason || "That file type isn't accepted" }, { status: 415 });
  }
  const { mime, kind } = check.sniffed;
  if (kind === "svg") {
    return Response.json({ error: "SVG uploads aren't accepted" }, { status: 415 });
  }

  const limit = MAX_BYTES[kind];
  if (bytes.byteLength > limit) {
    return Response.json(
      { error: `That file is over the ${Math.round(limit / 1024 / 1024)}MB limit` },
      { status: 413 }
    );
  }

  try {
    const result = await uploadOrgFile(
      siteConfig.orgId,
      `Media/${folderForMime(mime)}`,
      file.name,
      bytes,
      mime,
      editor.userId
    );
    if (!result) return Response.json({ error: "Upload failed" }, { status: 502 });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[fourthway] upload:", error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
