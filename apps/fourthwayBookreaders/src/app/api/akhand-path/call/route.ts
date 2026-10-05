import { fileCallRecordings, getCallState, getPaathReader, setCallRecording } from "@/lib/paath";

/** The Talk room: who is in the call, and recording it on request. Any reader. */
export const dynamic = "force-dynamic";

const nope = () => Response.json({ error: "Not found" }, { status: 404 });

export async function GET() {
  const access = await getPaathReader();
  if (!access) return nope();
  await fileCallRecordings(access.circle).catch(() => 0);
  return Response.json({ call: await getCallState(access.circle) });
}

export async function POST(request: Request) {
  const access = await getPaathReader();
  if (!access) return nope();
  const body = (await request.json().catch(() => null)) as { record?: boolean } | null;
  if (typeof body?.record !== "boolean") return Response.json({ error: "record is required" }, { status: 400 });
  const result = await setCallRecording(access.circle, body.record);
  return Response.json({ ...result, call: await getCallState(access.circle) }, { status: result.ok ? 200 : 409 });
}
