import { NextResponse, type NextRequest } from "next/server";
import { hideHubReply } from "@/lib/hub-forum-replies";

/**
 * POST { replyId, hidden } -> hide (true) or unhide (false) one reply. Owners and guides of the topic's org,
 * and network admins (what `canModerate` admits); the service checks it and logs the act to `events`.
 * Answers "not switched on yet" until the replies.hidden_at migration is applied.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { replyId?: string; hidden?: boolean } | null;
  if (!body?.replyId || typeof body.hidden !== "boolean") return NextResponse.json({ ok: false, error: "Not found." }, { status: 400 });
  const r = await hideHubReply(body.replyId, body.hidden);
  return NextResponse.json(r.ok ? { ok: true, hidden: r.hidden } : { ok: false, error: r.error }, { status: r.status });
}
