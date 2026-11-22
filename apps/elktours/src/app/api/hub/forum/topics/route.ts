import { NextResponse, type NextRequest } from "next/server";
import { topicAction } from "@/lib/forum-data";

/** POST { feedSlug, title, text, kind?, audience?, link?, attachments? } -> start a topic. The services check who may post where. */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => null)) as Parameters<typeof topicAction>[0] | null;
  if (!b?.feedSlug) return NextResponse.json({ ok: false, error: "Choose a section." }, { status: 400 });
  const r = await topicAction(b);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
