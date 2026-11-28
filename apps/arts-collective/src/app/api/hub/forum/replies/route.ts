import { NextResponse, type NextRequest } from "next/server";
import { loadHubReplies, postHubReply } from "@/lib/hub-forum-replies";

/**
 * GET ?thread=ID[&page=N] -> a topic's replies for the thread frame (404 when this session may not read the topic).
 * POST { threadId, text, parentId? } -> post a reply as the signed-in viewer (401 signed out).
 * The user is the session's in both; nothing is read from params or the body to say who is acting.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("thread") ?? "";
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1) || 1);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await loadHubReplies(id, page);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { threadId?: string; text?: string; parentId?: string | null } | null;
  if (!body?.threadId) return NextResponse.json({ ok: false, error: "Not found." }, { status: 400 });
  const r = await postHubReply({ threadId: body.threadId, text: body.text ?? "", parentId: body.parentId ?? null });
  return NextResponse.json(r.ok ? { ok: true, replyId: r.replyId } : { ok: false, error: r.error }, { status: r.status });
}
