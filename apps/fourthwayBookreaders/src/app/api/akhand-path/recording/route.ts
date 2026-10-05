import { validateUploadBuffer } from "@elkdonis/utils";
import { getPaathReader, RECORDING_TYPES, saveRecording } from "@/lib/paath";

/**
 * A reading recorded in the browser (MediaRecorder), saved into the day's
 * folder: <circle>/Meeting Recordings/<YYYY-MM-DD> Day N/. Any reader.
 */
export const dynamic = "force-dynamic";

/** About 8 hours of Opus at the browser's default bitrate. */
const MAX_BYTES = 400 * 1024 * 1024;

export async function POST(request: Request) {
  const access = await getPaathReader();
  if (!access) return Response.json({ error: "Not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected a file upload" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "No recording" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "That recording is too large" }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Trust the content: WebM sniffs as video, Ogg as audio, Safari's MP4 as video.
  const check = validateUploadBuffer(bytes, ["audio", "video"]);
  if ("reason" in check) return Response.json({ error: check.reason || "That isn't an audio recording" }, { status: 415 });
  const declared = (file.type || "").split(";")[0];
  const mime = RECORDING_TYPES.includes(declared) ? declared : check.sniffed.mime;

  const started = new Date(String(form.get("startedAt") ?? ""));
  const startedAt = Number.isNaN(started.getTime()) || started.getTime() > Date.now() ? new Date() : started;
  const saved = await saveRecording(access.circle, access.viewer, bytes, mime, startedAt);
  return saved ? Response.json({ recording: saved }) : Response.json({ error: "The recording could not be saved" }, { status: 502 });
}
