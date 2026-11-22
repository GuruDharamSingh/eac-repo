import { NextResponse, type NextRequest } from "next/server";
import { loadReplies, replyAction } from "@/lib/forum-data";

/** GET ?thread=ID[&page=N] -> a topic's replies for the phone surfaces. POST { threadId, text, parentId?, attachments? } -> post a reply. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("thread") ?? "";
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1) || 1);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await loadReplies(id, page);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { threadId?: string; text?: string; parentId?: string | null; attachments?: never[] } | null;
  if (!body?.threadId) return NextResponse.json({ ok: false, error: "Not found." }, { status: 400 });
  const r = await replyAction({ threadId: body.threadId, text: body.text ?? "", parentId: body.parentId ?? null, attachments: body.attachments });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
